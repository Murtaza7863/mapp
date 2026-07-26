import { isSameDay, parseISO } from "date-fns";

import type { CompletionLog, Item } from "../types";

import { isDueToday, isOverdue } from "./dates";
import { countNeedsChase } from "./pipeline";

export interface WrapUpSummary {
  doneToday: number;
  stillOpen: number;
  overdue: number;
  dueToday: number;
  needsNudge: number;
  parkable: Item[];
  headline: string;
}

export function computeWrapUpSummary(
  items: Item[],
  completions: CompletionLog[],
  now = new Date(),
): WrapUpSummary {
  const doneToday = completions.filter((c) =>
    isSameDay(parseISO(c.completedAt), now),
  ).length;

  const pending = items.filter((i) => i.status === "pending");
  const overdue = pending.filter(
    (i) => i.type !== "routine" && isOverdue(i),
  ).length;
  const dueToday = pending.filter(
    (i) => i.type !== "routine" && isDueToday(i) && !isOverdue(i),
  ).length;
  const needsNudge = countNeedsChase(items, now);
  const stillOpen = pending.length;

  const parkable = pending.filter(
    (i) =>
      i.type !== "follow-up" &&
      i.type !== "routine" &&
      (isOverdue(i) || isDueToday(i)),
  );

  let headline = `${doneToday} done today`;
  if (stillOpen > 0) {
    headline += ` · ${stillOpen} still open`;
  } else {
    headline += " · inbox clear";
  }

  return {
    doneToday,
    stillOpen,
    overdue,
    dueToday,
    needsNudge,
    parkable,
    headline,
  };
}

export function isWrapUpTime(now = new Date()): boolean {
  return now.getHours() >= 17;
}
