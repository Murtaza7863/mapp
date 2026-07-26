import { db } from "../db";
import { getSettings } from "../db";
import type { Item } from "../types";
import { getNotificationFireTime } from "./dates";
import {
  buildEventDeadlineEntries,
  deadlineUrgency,
} from "./event-deadlines";
import { chaseReason, needsChase } from "./pipeline";
import { canUseWebPush, pushBlockReason } from "./pwa";

const API_BASE = import.meta.env.VITE_PUSH_API_URL ?? "";

export type PushSetupResult = { ok: true } | { ok: false; reason: string };

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function buildScheduledNotifications(
  items: Item[],
  now = Date.now(),
): Array<{
  id: string;
  fireAt: string;
  title: string;
  body: string;
  url: string;
}> {
  const scheduled: Array<{
    id: string;
    fireAt: string;
    title: string;
    body: string;
    url: string;
  }> = [];

  for (const item of items) {
    if (item.type === "note" || item.type === "project") continue;
    if (item.notificationsMuted) continue;

    const dueFire = item.dueAt ? getNotificationFireTime(item) : null;
    if (dueFire && new Date(dueFire).getTime() > now - 60_000) {
      scheduled.push({
        id: `${item.id}-due`,
        fireAt: dueFire,
        title: notificationTitle(item),
        body: notificationBody(item),
        url: notificationUrl(item),
      });
    }

    if (item.type === "follow-up" && item.checkBackAt) {
      const fireAt = getNotificationFireTime({
        ...item,
        dueAt: item.checkBackAt,
      });
      if (fireAt && new Date(fireAt).getTime() > now - 60_000) {
        scheduled.push({
          id: `${item.id}-checkback`,
          fireAt,
          title: `Look back: ${item.contactName ?? item.title}`,
          body: item.nextAction ?? "Time to revisit this thread",
          url: `/follow-ups?item=${item.id}`,
        });
      }
    }

    if (item.type === "follow-up" && needsChase(item, new Date(now))) {
      const fireAt = nextChaseNudgeTime(now);
      scheduled.push({
        id: `${item.id}-chase`,
        fireAt,
        title: `Nudge: ${item.contactName ?? item.title}`,
        body: chaseReason(item, new Date(now)),
        url: `/follow-ups?item=${item.id}`,
      });
    }

    if (item.type === "follow-up" && item.linkedEventAt) {
      const entry = buildEventDeadlineEntries([item])[0];
      if (entry && deadlineUrgency(entry.daysUntilPrep) !== "low") {
        const fireAt = getNotificationFireTime({
          ...item,
          dueAt: entry.prepDueAt,
        });
        if (fireAt && new Date(fireAt).getTime() > now - 60_000) {
          scheduled.push({
            id: `${item.id}-prep`,
            fireAt,
            title: `Prep due: ${item.contactName ?? item.title}`,
            body: `Event prep deadline in ${entry.daysUntilPrep}d`,
            url: `/follow-ups?item=${item.id}`,
          });
        }
      }
    }
  }

  return scheduled;
}

export async function registerPushSubscription(): Promise<PushSetupResult> {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey || !API_BASE) {
    return {
      ok: false,
      reason: "Push is not configured for this build.",
    };
  }

  const blockReason = pushBlockReason();
  if (blockReason) return { ok: false, reason: blockReason };

  if (!canUseWebPush()) {
    return { ok: false, reason: "Push is not available here." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Notification permission was denied." };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const settings = await getSettings();
  const subscribeRes = await fetch(`${API_BASE}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: settings.deviceId,
      subscription: subscription.toJSON(),
    }),
  });
  if (!subscribeRes.ok) {
    return { ok: false, reason: "Could not register with the push server." };
  }

  await db.settings.update("app", {
    notificationsEnabled: true,
    lastSyncError: undefined,
  });
  const synced = await syncNotificationSchedule();
  if (!synced.ok) {
    return { ok: false, reason: synced.reason ?? "Could not sync schedule." };
  }
  return { ok: true };
}

export async function syncNotificationSchedule(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey || !API_BASE) return { ok: true };

  const settings = await getSettings();
  if (!settings.notificationsEnabled) return { ok: true };

  const items = await db.items
    .where("status")
    .anyOf(["pending", "snoozed"])
    .toArray();
  const scheduled = buildScheduledNotifications(items);

  try {
    const res = await fetch(`${API_BASE}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: settings.deviceId,
        digestEnabled: settings.digestEnabled,
        digestTime: settings.digestTime,
        notifications: scheduled,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      const reason = body?.error ?? "Schedule sync failed.";
      await db.settings.update("app", { lastSyncError: reason });
      return { ok: false, reason };
    }
    await db.settings.update("app", { lastSyncError: undefined });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Schedule sync failed.";
    await db.settings.update("app", { lastSyncError: reason });
    return { ok: false, reason };
  }
}

export async function unregisterPushSubscription(): Promise<PushSetupResult> {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey || !API_BASE) {
    await db.settings.update("app", { notificationsEnabled: false });
    return { ok: true };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch {
    /* best effort */
  }

  await db.settings.update("app", {
    notificationsEnabled: false,
    lastSyncError: undefined,
  });
  return { ok: true };
}

function notificationUrl(item: Item): string {
  if (item.type === "follow-up") return `/follow-ups?item=${item.id}`;
  if (item.parentId) return `/folders/${item.parentId}`;
  return `/?item=${item.id}`;
}

function notificationTitle(item: Item): string {
  if (item.type === "follow-up") return `Follow up: ${item.title}`;
  if (item.type === "routine") return `Routine: ${item.title}`;
  if (item.priority) return `Priority: ${item.title}`;
  return item.title;
}

function notificationBody(item: Item): string {
  if (item.waitingOn) return `Waiting on: ${item.waitingOn}`;
  if (item.notes) return item.notes.slice(0, 120);
  return "Open mApp";
}

/** Next local 9am — used for chase nudge reminders. */
function nextChaseNudgeTime(nowMs: number): string {
  const d = new Date(nowMs);
  d.setHours(9, 0, 0, 0);
  if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
