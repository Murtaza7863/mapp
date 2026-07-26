import type { Item } from "../types";

import { buildEventDeadlineEntries, deadlineUrgency } from "./event-deadlines";
import { isDueToday, isOverdue } from "./dates";
import { countNeedsChase } from "./pipeline";

export interface DailyBriefing {
  overdue: number;
  dueToday: number;
  needsNudge: number;
  urgentPrep: number;
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
  const urgentPrep = buildEventDeadlineEntries(items).filter(
    (e) => deadlineUrgency(e.daysUntilPrep) === "high",
  ).length;
  const snoozed = items.filter((i) => i.status === "snoozed").length;

  let headline = "You're clear";
  if (needsNudge > 0 && overdue > 0) {
    headline = `${needsNudge} thread${needsNudge === 1 ? "" : "s"} need a nudge · ${overdue} overdue`;
  } else if (needsNudge > 0) {
    headline = `${needsNudge} thread${needsNudge === 1 ? "" : "s"} need a nudge`;
  } else if (urgentPrep > 0 && overdue > 0) {
    headline = `${urgentPrep} prep deadline${urgentPrep === 1 ? "" : "s"} · ${overdue} overdue`;
  } else if (urgentPrep > 0) {
    headline = `${urgentPrep} event prep deadline${urgentPrep === 1 ? "" : "s"} this week`;
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
  if (urgentPrep > 0 && needsNudge === 0) {
    parts.push(`${urgentPrep} prep due soon`);
  }
  if (snoozed > 0) parts.push(`${snoozed} snoozed`);
  const subline =
    parts.length > 0 ? parts.join(" · ") : "Capture or plot when something comes up";

  return { overdue, dueToday, needsNudge, urgentPrep, snoozed, headline, subline };
}
