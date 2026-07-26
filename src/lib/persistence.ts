import { db, updateSettings } from "../db";
import { exportData, importData, type ExportBundle } from "./export";
import { syncNotificationSchedule } from "./notifications";

export interface DbBackup {
  id: "latest" | "previous";
  savedAt: string;
  data: string;
}

let backupTimer: ReturnType<typeof setTimeout> | null = null;
const BACKUP_DEBOUNCE_MS = 15_000;

/** Ask the browser not to evict storage under memory pressure (best effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Run push sync in the background — never throw to callers. */
export async function safeSyncNotifications(): Promise<void> {
  try {
    await syncNotificationSchedule();
  } catch (err) {
    console.error("Notification sync failed:", err);
  }
}

export function scheduleAutoBackup(): void {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    void runAutoBackup();
  }, BACKUP_DEBOUNCE_MS);
}

export async function runAutoBackup(): Promise<void> {
  try {
    const bundle = await exportData();
    const json = JSON.stringify(bundle);
    const latest = await db.backups.get("latest");
    if (latest) {
      await db.backups.put({
        id: "previous",
        savedAt: latest.savedAt,
        data: latest.data,
      });
    }
    await db.backups.put({
      id: "latest",
      savedAt: bundle.exportedAt,
      data: json,
    });
    await updateSettings({ lastAutoBackupAt: bundle.exportedAt });
  } catch (err) {
    console.error("Auto-backup failed:", err);
  }
}

export async function afterDataMutation(): Promise<void> {
  scheduleAutoBackup();
  await safeSyncNotifications();
}

export async function getLatestBackup(): Promise<ExportBundle | null> {
  const row = await db.backups.get("latest");
  if (!row) return null;
  try {
    return JSON.parse(row.data) as ExportBundle;
  } catch {
    return null;
  }
}

export async function restoreFromAutoBackup(): Promise<void> {
  const bundle = await getLatestBackup();
  if (!bundle) throw new Error("No auto-backup found");
  await importData(bundle, true);
  await safeSyncNotifications();
}

export async function shouldOfferBackupRestore(): Promise<boolean> {
  const [itemCount, backup] = await Promise.all([
    db.items.count(),
    getLatestBackup(),
  ]);
  return itemCount === 0 && backup !== null && backup.items.length > 0;
}

export async function storageSummary(): Promise<{
  persisted: boolean;
  usageMb: number;
  quotaMb: number;
}> {
  let persisted = false;
  let usageMb = 0;
  let quotaMb = 0;
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    usageMb = (est.usage ?? 0) / 1_048_576;
    quotaMb = (est.quota ?? 0) / 1_048_576;
  }
  if (navigator.storage?.persisted) {
    persisted = await navigator.storage.persisted();
  }
  return { persisted, usageMb, quotaMb };
}
