import { formatDistanceToNow, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";

import { PageHeader } from "../components/ui";
import { db, updateSettings } from "../db";
import { useCategories } from "../hooks/useCategories";
import { useToast } from "../hooks/useToast";
import {
  downloadJson,
  exportData,
  exportDataForCategory,
  importData,
} from "../lib/export";
import {
  registerPushSubscription,
  syncNotificationSchedule,
  unregisterPushSubscription,
} from "../lib/notifications";
import {
  restoreFromAutoBackup,
  runAutoBackup,
  storageSummary,
} from "../lib/persistence";
import { isIos, isStandalone } from "../lib/pwa";
import { REMINDER_OFFSET_OPTIONS } from "../types";

export function SettingsView() {
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const { categories } = useCategories();
  const { toast } = useToast();
  const [importError, setImportError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{
    persisted: boolean;
    usageMb: number;
    quotaMb: number;
  } | null>(null);
  const [notifyPermission, setNotifyPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    void storageSummary().then(setStorageInfo);
  }, [settings?.lastAutoBackupAt]);

  useEffect(() => {
    if (settings?.notificationsEnabled) {
      syncNotificationSchedule().catch(console.error);
    }
  }, [
    settings?.notificationsEnabled,
    settings?.digestEnabled,
    settings?.digestTime,
  ]);

  const showStatus = (msg: string, kind: "success" | "error" = "success") => {
    toast(msg, { kind });
  };

  const handleDisablePush = async () => {
    const result = await unregisterPushSubscription();
    showStatus(
      result.ok ? "Notifications off" : result.reason,
      result.ok ? "success" : "error",
    );
  };

  const handleSync = async () => {
    const result = await syncNotificationSchedule();
    showStatus(
      result.ok ? "Schedule synced" : (result.reason ?? "Sync failed"),
      result.ok ? "success" : "error",
    );
  };

  const handleAreaExport = async (categoryId: string, name: string) => {
    try {
      const data = await exportDataForCategory(categoryId);
      await downloadJson(
        data,
        `mapp-${name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`,
      );
      showStatus(`Exported ${name}`);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Export failed", "error");
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      await downloadJson(
        data,
        `mapp-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      await updateSettings({ lastManualBackupAt: new Date().toISOString() });
      showStatus("Export ready");
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Export failed");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !window.confirm(
        "Import replaces all tasks, areas, and history on this device. Continue?",
      )
    ) {
      e.target.value = "";
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data, true);
      await syncNotificationSchedule();
      showStatus("Import complete");
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    }
    e.target.value = "";
  };

  const handleEnablePush = async () => {
    try {
      const result = await registerPushSubscription();
      setNotifyPermission(Notification.permission);
      showStatus(result.ok ? "Notifications on" : result.reason);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Push setup failed");
    }
  };

  const pushConfigured = Boolean(
    import.meta.env.VITE_VAPID_PUBLIC_KEY && import.meta.env.VITE_PUSH_API_URL,
  );
  const installed = isStandalone();

  return (
    <div>
      <PageHeader title="Settings" subtitle="Notifications and backup" />

      <section className="glass-card mb-6 rounded-2xl p-4">
        <h2 className="mb-3 font-semibold">Install</h2>
        <dl className="text-muted space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Home Screen app</dt>
            <dd className={installed ? "text-emerald-400" : "text-amber-400"}>
              {installed ? "Installed" : "Not installed"}
            </dd>
          </div>
          {isIos() && !installed && (
            <p className="text-muted text-xs leading-relaxed">
              Safari: Share, then Add to Home Screen. Open the app from that
              icon before enabling notifications.
            </p>
          )}
        </dl>
      </section>

      <section className="glass-card mb-6 rounded-2xl p-4">
        <h2 className="mb-3 font-semibold">Notifications</h2>
        {!pushConfigured && (
          <p className="text-amber-400/90 mb-3 text-sm">
            Set VITE_PUSH_API_URL and VITE_VAPID_PUBLIC_KEY when deploying.
          </p>
        )}
        <dl className="text-muted mb-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Permission</dt>
            <dd className="text-primary capitalize">{notifyPermission}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Push enabled</dt>
            <dd className="text-primary">
              {settings?.notificationsEnabled ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={handleEnablePush}
          disabled={!pushConfigured}
          className="btn-primary mb-2 w-full rounded-xl py-3 disabled:opacity-40"
        >
          Enable notifications
        </button>
        {settings?.notificationsEnabled && (
          <button
            type="button"
            onClick={handleDisablePush}
            className="btn-ghost mb-2 w-full rounded-xl py-3"
          >
            Disable notifications
          </button>
        )}
        <button
          type="button"
          onClick={handleSync}
          disabled={!pushConfigured || !settings?.notificationsEnabled}
          className="btn-ghost mb-4 w-full rounded-xl py-3 disabled:opacity-40"
        >
          Sync schedule now
        </button>
        {settings?.lastSyncError && (
          <p className="text-red-400/90 mb-3 text-xs">
            {settings.lastSyncError}
          </p>
        )}

        <label className="flex items-center justify-between py-2">
          <span className="text-sm">Daily digest</span>
          <input
            type="checkbox"
            checked={settings?.digestEnabled ?? false}
            onChange={async (e) => {
              await updateSettings({ digestEnabled: e.target.checked });
              await syncNotificationSchedule();
            }}
            className="rounded"
          />
        </label>

        {settings?.digestEnabled && (
          <label className="mt-2 block">
            <span className="text-muted mb-1 block text-xs">
              Digest time
            </span>
            <input
              type="time"
              value={settings.digestTime}
              onChange={async (e) => {
                await updateSettings({ digestTime: e.target.value });
                await syncNotificationSchedule();
              }}
              className="border-zinc-800 bg-zinc-900 rounded-lg border px-3 py-2"
            />
          </label>
        )}
      </section>

      <section className="glass-card mb-6 rounded-2xl p-4">
        <h2 className="mb-3 font-semibold">Preferences</h2>

        <label className="mb-3 block">
          <span className="text-muted mb-1 block text-xs">
            Default reminder offset
          </span>
          <select
            value={settings?.defaultReminderOffsetMinutes ?? 0}
            onChange={(e) =>
              updateSettings({
                defaultReminderOffsetMinutes: Number(e.target.value),
              })
            }
            className="border-zinc-800 bg-zinc-900 text-primary w-full rounded-lg border px-3 py-2"
          >
            {REMINDER_OFFSET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="text-muted mb-1 block text-xs">
            Default area for new tasks
          </span>
          <select
            value={settings?.defaultCategoryId ?? ""}
            onChange={(e) =>
              updateSettings({
                defaultCategoryId: e.target.value || undefined,
              })
            }
            className="border-zinc-800 bg-zinc-900 text-primary w-full rounded-lg border px-3 py-2"
          >
            <option value="">Ask each time</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between py-2">
          <span className="text-sm">Week starts on Monday</span>
          <input
            type="checkbox"
            checked={settings?.weekStartsOnMonday ?? false}
            onChange={(e) =>
              updateSettings({ weekStartsOnMonday: e.target.checked })
            }
            className="rounded"
          />
        </label>
      </section>

      <section className="glass-card mb-6 rounded-2xl p-4">
        <h2 className="mb-3 font-semibold">Data safety</h2>
        <dl className="text-muted mb-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Auto-backup</dt>
            <dd className="text-primary text-right">
              {settings?.lastAutoBackupAt
                ? formatDistanceToNow(parseISO(settings.lastAutoBackupAt), {
                    addSuffix: true,
                  })
                : "Not yet"}
            </dd>
          </div>
          {settings?.lastManualBackupAt && (
            <div className="flex justify-between gap-4">
              <dt>Last export</dt>
              <dd className="text-primary text-right">
                {formatDistanceToNow(parseISO(settings.lastManualBackupAt), {
                  addSuffix: true,
                })}
              </dd>
            </div>
          )}
          {storageInfo && (
            <div className="flex justify-between gap-4">
              <dt>Storage</dt>
              <dd className="text-primary text-right">
                {storageInfo.usageMb.toFixed(1)} MB
                {storageInfo.quotaMb > 0 &&
                  ` / ${storageInfo.quotaMb.toFixed(0)} MB`}
                {storageInfo.persisted ? " · protected" : ""}
              </dd>
            </div>
          )}
        </dl>
        <button
          type="button"
          onClick={async () => {
            try {
              await runAutoBackup();
              showStatus("Auto-backup saved");
            } catch (err) {
              showStatus(
                err instanceof Error ? err.message : "Backup failed",
                "error",
              );
            }
          }}
          className="btn-ghost mb-2 w-full rounded-xl py-3"
        >
          Save auto-backup now
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await restoreFromAutoBackup();
              showStatus("Restored from auto-backup");
            } catch (err) {
              showStatus(
                err instanceof Error ? err.message : "Restore failed",
                "error",
              );
            }
          }}
          className="btn-ghost mb-4 w-full rounded-xl py-3"
        >
          Restore from auto-backup
        </button>
      </section>

      <section className="glass-card mb-6 rounded-2xl p-4">
        <h2 className="mb-3 font-semibold">Backup</h2>
        <p className="text-muted mb-3 text-sm">
          Data is stored on this device. Auto-backups keep the last 2 snapshots
          on-device — export JSON before switching phones.
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="border-zinc-800 text-primary mb-3 w-full rounded-xl border py-3"
        >
          Export all JSON
        </button>
        {categories.length > 0 && (
          <div className="mb-3 space-y-2">
            <p className="text-muted text-xs">Export by area</p>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleAreaExport(cat.id, cat.name)}
                className="btn-ghost w-full rounded-xl py-2.5 text-sm"
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
        <label className="border-zinc-800 text-primary block w-full cursor-pointer rounded-xl border py-3 text-center">
          Import JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
        {importError && (
          <p className="text-red-400 mt-2 text-sm">{importError}</p>
        )}
      </section>

      <section className="border-zinc-900 bg-zinc-950/50 text-muted rounded-xl border p-4 text-sm">
        <h2 className="text-primary mb-2 font-semibold">About</h2>
        <p>Local storage only. Data stays on this device.</p>
        <p className="mt-2">Device ID: {settings?.deviceId?.slice(0, 8)}…</p>
      </section>
    </div>
  );
}
