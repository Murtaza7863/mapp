import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Category, Item } from "../types";
import { gpdDueFromEvent } from "./pipeline";

export interface ClimbEntry {
  item: Item;
  linkedEventAt: string;
  gpdDueAt: string;
  daysUntilGpd: number;
  daysUntilEvent: number;
}

export function getClimbCategoryId(categories: Category[]): string | undefined {
  return categories.find((c) => c.name.toLowerCase() === "climb")?.id;
}

export function buildClimbEntries(
  items: Item[],
  climbCategoryId?: string,
): ClimbEntry[] {
  if (!climbCategoryId) return [];

  return items
    .filter(
      (i) =>
        i.categoryId === climbCategoryId &&
        i.type === "follow-up" &&
        i.status !== "done" &&
        i.linkedEventAt,
    )
    .map((item) => {
      const gpd = gpdDueFromEvent(item.linkedEventAt!);
      const now = new Date();
      return {
        item,
        linkedEventAt: item.linkedEventAt!,
        gpdDueAt: gpd.toISOString(),
        daysUntilGpd: differenceInCalendarDays(gpd, now),
        daysUntilEvent: differenceInCalendarDays(
          parseISO(item.linkedEventAt!),
          now,
        ),
      };
    })
    .sort((a, b) => a.daysUntilGpd - b.daysUntilGpd);
}

export function formatGpdDue(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

export function gpdUrgency(daysUntil: number): "high" | "medium" | "low" {
  if (daysUntil <= 7) return "high";
  if (daysUntil <= 21) return "medium";
  return "low";
}
