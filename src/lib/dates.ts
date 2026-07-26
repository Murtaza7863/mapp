import {
  addDays,
  addWeeks,
  format,
  isBefore,
  isSameDay,
  isToday,
  isTomorrow,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfWeek,
} from "date-fns";
import type { Item, RecurrenceRule } from "../types";

export function parseDate(iso?: string): Date | null {
  if (!iso) return null;
  return parseISO(iso);
}

export function formatDue(iso?: string): string {
  const d = parseDate(iso);
  if (!d) return "No date";
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

export function formatSnoozedUntil(iso?: string): string {
  const d = parseDate(iso);
  if (!d) return "Snoozed";
  if (isToday(d)) return `Snoozed until ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Snoozed until tomorrow ${format(d, "h:mm a")}`;
  return `Snoozed until ${format(d, "MMM d, h:mm a")}`;
}

export function formatCompleted(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy h:mm a");
}

export function isOverdue(item: Item): boolean {
  if (item.status !== "pending" || !item.dueAt) return false;
  return isBefore(parseISO(item.dueAt), new Date());
}

export function isDueToday(item: Item): boolean {
  if (item.status !== "pending") return false;
  if (item.snoozedUntil) {
    const snooze = parseISO(item.snoozedUntil);
    if (snooze > new Date()) return false;
  }
  if (!item.dueAt) return item.priority;
  return isToday(parseISO(item.dueAt)) || isOverdue(item);
}

export function isUpcoming(item: Item, withinDays = 7): boolean {
  if (item.status !== "pending" || !item.dueAt) return false;
  const due = parseISO(item.dueAt);
  const now = new Date();
  if (isBefore(due, startOfDay(now))) return false;
  const limit = addDays(startOfDay(now), withinDays);
  return !isToday(due) && due <= limit;
}

export function getNextOccurrence(
  rule: RecurrenceRule,
  from: Date = new Date(),
): Date {
  const base = startOfDay(from);
  const hour = from.getHours();
  const minute = from.getMinutes();

  if (rule.frequency === "daily") {
    let next = setMinutes(setHours(base, hour), minute);
    if (next <= from) next = addDays(next, 1);
    return next;
  }

  if (rule.frequency === "weekdays") {
    let next = setMinutes(setHours(base, hour), minute);
    for (let i = 0; i < 8; i++) {
      const day = next.getDay();
      if (day >= 1 && day <= 5 && next > from) return next;
      next = addDays(next, 1);
    }
    return next;
  }

  if (rule.frequency === "weekly" || rule.frequency === "custom") {
    const days = rule.daysOfWeek?.length ? rule.daysOfWeek : [from.getDay()];
    let candidate = setMinutes(setHours(base, hour), minute);
    for (let i = 0; i < 14; i++) {
      if (days.includes(candidate.getDay()) && candidate > from)
        return candidate;
      candidate = addDays(candidate, 1);
    }
    return addWeeks(candidate, 1);
  }

  return addDays(from, 1);
}

export function groupByDate(items: Item[]): Map<string, Item[]> {
  const map = new Map<string, Item[]>();
  for (const item of items) {
    if (!item.dueAt) continue;
    const key = format(parseISO(item.dueAt), "yyyy-MM-dd");
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export function sameDayKey(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

export function isSameDayISO(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return isSameDay(parseISO(a), parseISO(b));
}

export function startOfMonthGrid(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function startOfWeekGrid(
  date: Date,
  weekStartsOnMonday = false,
): Date[] {
  const start = startOfWeek(date, {
    weekStartsOn: weekStartsOnMonday ? 1 : 0,
  });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getNotificationFireTime(item: Item): string | null {
  if (item.snoozedUntil) {
    const snooze = parseISO(item.snoozedUntil);
    if (snooze > new Date()) return snooze.toISOString();
  }
  if (!item.dueAt) return null;
  const due = parseISO(item.dueAt);
  const offset = item.reminderOffsetMinutes ?? 0;
  if (offset <= 0) return due.toISOString();
  return new Date(due.getTime() - offset * 60_000).toISOString();
}
