import type { Item } from "../types";

import { isDueToday, isOverdue } from "./dates";
import { countNeedsChase } from "./pipeline";

export interface DailyBriefing {
  overdue: number;
  dueToday: number;
  needsNudge: number;
  snoozed: number;
  headline: string;
  subline: string;
}

export function computeDailyBriefing(
  items: Item[],
  now = new Date(),
): DailyBriefing {
  const pending = items.filter((i) => i.status === "pending");
  const overdue = pending.filter(
    (i) => i.type !== "routine" && isOverdue(i),
  ).length;
  const dueToday = pending.filter(
    (i) => i.type !== "routine" && isDueToday(i) && !isOverdue(i),
  ).length;
  const needsNudge = countNeedsChase(items, now);
  const snoozed = items.filter((i) => i.status === "snoozed").length;

  let headline = "You're clear";
  if (needsNudge > 0 && overdue > 0) {
    headline = `${needsNudge} thread${needsNudge === 1 ? "" : "s"} need a nudge · ${overdue} overdue`;
  } else if (needsNudge > 0) {
    headline = `${needsNudge} thread${needsNudge === 1 ? "" : "s"} need a nudge`;
  } else if (overdue > 0) {
    headline = `${overdue} overdue`;
  } else if (dueToday > 0) {
    headline = `${dueToday} due today`;
  }

  const parts: string[] = [];
  if (dueToday > 0 && overdue === 0 && needsNudge === 0) {
    parts.push(`${dueToday} due today`);
  } else if (dueToday > 0) {
    parts.push(`${dueToday} due today`);
  }
  if (snoozed > 0) parts.push(`${snoozed} snoozed`);
  const subline =
    parts.length > 0 ? parts.join(" · ") : "Capture or plot when something comes up";

  return { overdue, dueToday, needsNudge, snoozed, headline, subline };
}
