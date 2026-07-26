import { format, parseISO } from "date-fns";

import type { Item } from "../types";

import { gpdDueFromEvent } from "./pipeline";

export interface CalendarEntry {
  item: Item;
  dayKey: string;
  kind: "due" | "check-back" | "gpd";
  label?: string;
}

export function calendarEntriesForItem(item: Item): CalendarEntry[] {
  if (item.status === "done") return [];
  const entries: CalendarEntry[] = [];

  if (item.dueAt) {
    entries.push({
      item,
      dayKey: format(parseISO(item.dueAt), "yyyy-MM-dd"),
      kind: "due",
    });
  }

  if (item.type === "follow-up" && item.checkBackAt) {
    entries.push({
      item,
      dayKey: format(parseISO(item.checkBackAt), "yyyy-MM-dd"),
      kind: "check-back",
      label: "Look back",
    });
  }

  if (item.type === "follow-up" && item.linkedEventAt) {
    const gpd = gpdDueFromEvent(item.linkedEventAt);
    entries.push({
      item,
      dayKey: format(gpd, "yyyy-MM-dd"),
      kind: "gpd",
      label: "Prep due",
    });
  }

  return entries;
}

export function buildCalendarIndex(
  items: Item[],
): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const item of items) {
    for (const entry of calendarEntriesForItem(item)) {
      const list = map.get(entry.dayKey) ?? [];
      list.push(entry);
      map.set(entry.dayKey, list);
    }
  }
  return map;
}
