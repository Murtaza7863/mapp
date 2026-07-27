import type { Item } from "../types";

import { endOfDay } from "date-fns";

import { buildEventDeadlineEntries, deadlineUrgency } from "./event-deadlines";
import { isDueToday, isOverdue } from "./dates";
import { countNeedsChase } from "./pipeline";

export interface DailyBriefing {
  overdue: number;
  dueToday: number;
  upcoming: number;
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
  const endToday = endOfDay(now);
  const upcoming = pending.filter(
    (i) => i.type !== "routine" && i.dueAt && new Date(i.dueAt) > endToday,
  ).length;

  let headline = "You're clear";
  if (needsNudge > 0 && overdue > 0) {
    headline = `${needsNudge} follow-up${needsNudge === 1 ? " needs" : "s need"} a nudge · ${overdue} overdue`;
  } else if (needsNudge > 0) {
    headline = `${needsNudge} follow-up${needsNudge === 1 ? " needs" : "s need"} a nudge`;
  } else if (urgentPrep > 0 && overdue > 0) {
    headline = `${urgentPrep} prep deadline${urgentPrep === 1 ? "" : "s"} · ${overdue} overdue`;
  } else if (urgentPrep > 0) {
    headline = `${urgentPrep} event prep deadline${urgentPrep === 1 ? "" : "s"} this week`;
  } else if (overdue > 0) {
    headline = `${overdue} overdue`;
  } else if (dueToday > 0) {
    headline = `${dueToday} due today`;
  } else if (upcoming > 0) {
    // Claiming "You're clear" while work is scheduled reads as a bug.
    headline = "Nothing due today";
  }

  const parts: string[] = [];
  if (dueToday > 0) parts.push(`${dueToday} due today`);
  if (upcoming > 0 && dueToday === 0 && overdue === 0) {
    parts.push(`${upcoming} coming up`);
  }
  if (urgentPrep > 0 && needsNudge === 0) {
    parts.push(`${urgentPrep} prep due soon`);
  }
  if (snoozed > 0) parts.push(`${snoozed} snoozed`);
  const subline =
    parts.length > 0 ? parts.join(" · ") : "Add something when it comes up";

  return {
    overdue,
    dueToday,
    upcoming,
    needsNudge,
    urgentPrep,
    snoozed,
    headline,
    subline,
  };
}
