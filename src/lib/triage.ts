import { parseISO, subDays } from "date-fns";

import type { Item } from "../types";

const TRIAGE_WINDOW_DAYS = 2;

/** Fresh captures without a schedule — inbox-zero candidates. */
export function findTriageCandidates(
  items: Item[],
  now = new Date(),
): Item[] {
  const cutoff = subDays(now, TRIAGE_WINDOW_DAYS);
  return items
    .filter(
      (item) =>
        item.status === "pending" &&
        item.type !== "note" &&
        item.type !== "routine" &&
        item.type !== "project" &&
        !item.parentId &&
        !item.dueAt &&
        !item.checkBackAt &&
        parseISO(item.createdAt) >= cutoff,
    )
    .sort(
      (a, b) =>
        parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime(),
    );
}

export function countTriageCandidates(items: Item[], now = new Date()): number {
  return findTriageCandidates(items, now).length;
}
