import { useEffect } from "react";
import { db } from "../db";
import { wakeSnoozedItem } from "../lib/items";
import { safeSyncNotifications } from "../lib/persistence";

async function wakeExpiredSnoozes() {
  const snoozed = await db.items.where("status").equals("snoozed").toArray();
  const now = Date.now();
  const toWake = snoozed.filter(
    (item) => item.snoozedUntil && new Date(item.snoozedUntil).getTime() <= now,
  );
  if (toWake.length === 0) return false;

  await db.transaction("rw", db.items, async () => {
    for (const item of toWake) {
      await db.items.put(wakeSnoozedItem(item));
    }
  });
  return true;
}

async function onResume() {
  try {
    const woke = await wakeExpiredSnoozes();
    const settings = await db.settings.get("app");
    if (woke || settings?.notificationsEnabled) {
      await safeSyncNotifications();
    }
  } catch (err) {
    console.error("Resume handler failed:", err);
  }
}

/** Wake snoozed items and refresh push schedule when the app returns to foreground. */
export function useAppLifecycle() {
  useEffect(() => {
    void onResume();
    const interval = setInterval(() => void onResume(), 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void onResume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", () => void onResume());

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", () => void onResume());
    };
  }, []);
}
