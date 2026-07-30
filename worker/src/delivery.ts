import type {
  PushMessagePayload,
  ScheduledNotification,
  SchedulePayload,
  SentLog,
} from "./types.js";

/**
 * How far past its fire time a reminder may still be delivered.
 *
 * This must comfortably exceed the cron interval. The previous version paired a
 * five-minute cron with a two-minute window, so any reminder whose fire time
 * landed in the other three minutes was skipped and never retried.
 */
export const LOOKBACK_MS = 15 * 60 * 1000;

/** A digest is a summary of the day, so it is worthless hours late. */
export const DIGEST_WINDOW_MINUTES = 30;

export function isDeliverable(
  notification: ScheduledNotification,
  sent: SentLog,
  now: number,
  lookbackMs = LOOKBACK_MS,
): boolean {
  if (sent[notification.id]) return false;
  const fireAt = Date.parse(notification.fireAt);
  if (!Number.isFinite(fireAt)) return false;
  return fireAt <= now && fireAt > now - lookbackMs;
}

export function dueNotifications(
  schedule: SchedulePayload,
  sent: SentLog,
  now: number,
  lookbackMs = LOOKBACK_MS,
): ScheduledNotification[] {
  return schedule.notifications
    .filter((n) => isDeliverable(n, sent, now, lookbackMs))
    .sort((a, b) => Date.parse(a.fireAt) - Date.parse(b.fireAt));
}

export function toPushPayload(
  notification: ScheduledNotification,
): PushMessagePayload {
  return {
    title: notification.title,
    body: notification.body,
    // Dropping this was why every reminder opened the home screen.
    url: notification.url ?? "/",
  };
}

interface LocalTime {
  date: string;
  minutesSinceMidnight: number;
}

/** Wall-clock time in the user's zone; the worker itself always runs in UTC. */
export function localTime(now: number, timeZone?: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutesSinceMidnight: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function parseDigestTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function digestKeyFor(date: string): string {
  return `digest:${date}`;
}

/**
 * The old check required the cron to land on the exact minute the user picked,
 * which with a five-minute cron essentially never happened.
 */
export function isDigestDue(
  schedule: SchedulePayload,
  sent: SentLog,
  now: number,
): boolean {
  if (!schedule.digestEnabled) return false;

  const target = parseDigestTime(schedule.digestTime ?? "");
  if (target === null) return false;

  const local = localTime(now, schedule.timeZone);
  if (sent[digestKeyFor(local.date)]) return false;

  const elapsed = local.minutesSinceMidnight - target;
  return elapsed >= 0 && elapsed <= DIGEST_WINDOW_MINUTES;
}

export function buildDigest(
  schedule: SchedulePayload,
  now: number,
  maxItems = 5,
): PushMessagePayload {
  const today = localTime(now, schedule.timeZone).date;
  const todays = schedule.notifications
    .filter((n) => {
      const fireAt = Date.parse(n.fireAt);
      if (!Number.isFinite(fireAt)) return false;
      return localTime(fireAt, schedule.timeZone).date === today;
    })
    .sort((a, b) => Date.parse(a.fireAt) - Date.parse(b.fireAt));

  if (todays.length === 0) {
    return { title: "Today", body: "Nothing due today.", url: "/" };
  }

  const lines = todays.slice(0, maxItems).map((n) => `• ${n.title}`);
  const remaining = todays.length - lines.length;
  if (remaining > 0) lines.push(`+${remaining} more`);

  return {
    title: `Today: ${todays.length} item${todays.length === 1 ? "" : "s"}`,
    body: lines.join("\n"),
    url: "/",
  };
}
