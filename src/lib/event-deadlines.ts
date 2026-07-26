import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Item } from "../types";
import { gpdDueFromEvent } from "./pipeline";

export interface EventDeadlineEntry {
  item: Item;
  linkedEventAt: string;
  prepDueAt: string;
  daysUntilPrep: number;
  daysUntilEvent: number;
}

/** Follow-ups with a linked event and an auto-calculated prep deadline. */
export function buildEventDeadlineEntries(items: Item[]): EventDeadlineEntry[] {
  return items
    .filter(
      (i) => i.type === "follow-up" && i.status !== "done" && i.linkedEventAt,
    )
    .map((item) => {
      const prep = gpdDueFromEvent(item.linkedEventAt!);
      const now = new Date();
      return {
        item,
        linkedEventAt: item.linkedEventAt!,
        prepDueAt: prep.toISOString(),
        daysUntilPrep: differenceInCalendarDays(prep, now),
        daysUntilEvent: differenceInCalendarDays(
          parseISO(item.linkedEventAt!),
          now,
        ),
      };
    })
    .sort((a, b) => a.daysUntilPrep - b.daysUntilPrep);
}

export function formatDeadlineDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

export function deadlineUrgency(daysUntil: number): "high" | "medium" | "low" {
  if (daysUntil <= 7) return "high";
  if (daysUntil <= 21) return "medium";
  return "low";
}
