import { parseISO } from "date-fns";
import type { Item } from "../types";
import { isDueToday, isOverdue, isUpcoming } from "./dates";
import { isActionable } from "./items";

export type FeedBucket =
  | "chase"
  | "overdue"
  | "today"
  | "routine"
  | "follow-up"
  | "snoozed"
  | "upcoming";

export interface FeedEntry {
  item: Item;
  bucket: FeedBucket;
  sortKey: number;
}

export const BUCKET_LABELS: Record<FeedBucket, string> = {
  chase: "Needs a nudge",
  overdue: "Overdue",
  today: "Today",
  routine: "Daily habits",
  "follow-up": "Threads due",
  snoozed: "Snoozed",
  upcoming: "Coming up",
};

const FEED_SECTION_ORDER: FeedBucket[] = [
  "overdue",
  "today",
  "routine",
  "follow-up",
  "snoozed",
  "upcoming",
];

export function groupFeedByBucket(
  feed: FeedEntry[],
): Map<FeedBucket, FeedEntry[]> {
  const map = new Map<FeedBucket, FeedEntry[]>();
  for (const bucket of FEED_SECTION_ORDER) map.set(bucket, []);
  for (const entry of feed) {
    if (entry.bucket === "chase") continue;
    map.get(entry.bucket)?.push(entry);
  }
  return map;
}

const BUCKET_ORDER: Record<FeedBucket, number> = {
  chase: -1,
  overdue: 0,
  today: 1,
  routine: 2,
  "follow-up": 3,
  snoozed: 4,
  upcoming: 5,
};

function dueTime(item: Item): number {
  if (!item.dueAt) return Number.MAX_SAFE_INTEGER;
  return parseISO(item.dueAt).getTime();
}

export function buildCommandFeed(
  items: Item[],
  options: { priorityOnly?: boolean } = {},
): FeedEntry[] {
  const { priorityOnly = false } = options;
  const entries: FeedEntry[] = [];
  const seen = new Set<string>();

  const add = (item: Item, bucket: FeedBucket) => {
    if (seen.has(item.id)) return;
    if (priorityOnly && !item.priority) return;
    seen.add(item.id);
    entries.push({
      item,
      bucket,
      sortKey: BUCKET_ORDER[bucket] * 1e15 + dueTime(item),
    });
  };

  const pending = items.filter(
    (i) => i.status === "pending" && isActionable(i) && !i.parentId,
  );
  const pendingChildren = items.filter(
    (i) => i.status === "pending" && isActionable(i) && i.parentId,
  );

  for (const item of pending.filter(
    (i) => i.type !== "routine" && isOverdue(i),
  )) {
    add(item, "overdue");
  }

  for (const item of pending.filter(
    (i) => i.type !== "routine" && isDueToday(i) && !isOverdue(i),
  )) {
    add(item, "today");
  }

  for (const item of items.filter(
    (i) =>
      i.type === "routine" &&
      i.status === "pending" &&
      (isDueToday(i) || isOverdue(i)),
  )) {
    add(item, "routine");
  }

  for (const item of items.filter(
    (i) =>
      i.type === "follow-up" &&
      i.status === "pending" &&
      i.dueAt &&
      (isOverdue(i) || isDueToday(i)),
  )) {
    add(item, "follow-up");
  }

  for (const item of items.filter((i) => i.status === "snoozed")) {
    add(item, "snoozed");
  }

  for (const item of pending.filter(
    (i) => i.type !== "routine" && isUpcoming(i, 7),
  )) {
    add(item, "upcoming");
  }

  for (const item of pendingChildren.filter((i) => isOverdue(i))) {
    add(item, "overdue");
  }
  for (const item of pendingChildren.filter(
    (i) => isDueToday(i) && !isOverdue(i),
  )) {
    add(item, "today");
  }
  for (const item of pendingChildren.filter((i) => isUpcoming(i, 7))) {
    add(item, "upcoming");
  }

  // Include tasks with no date or due later than 7 days
  for (const item of [...pending, ...pendingChildren]) {
    if (seen.has(item.id) || item.type === "routine") continue;
    add(item, "upcoming");
  }

  return entries.sort((a, b) => {
    if (a.item.priority !== b.item.priority) return a.item.priority ? -1 : 1;
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.item.title.localeCompare(b.item.title);
  });
}

export function groupFeedByArea(
  feed: FeedEntry[],
  getCategoryName: (id: string) => string,
): Map<string, FeedEntry[]> {
  const map = new Map<string, FeedEntry[]>();
  for (const entry of feed) {
    const key = getCategoryName(entry.item.categoryId) || "Uncategorized";
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}
