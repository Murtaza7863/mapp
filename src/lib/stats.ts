import {
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import type { Category, CompletionLog, Item } from "../types";
import { isDueToday, isOverdue } from "./dates";
import { countNeedsChase } from "./pipeline";

export interface TodaySummary {
  overdue: number;
  dueToday: number;
  routines: number;
  /** All open follow-up threads */
  openThreads: number;
  /** Threads that need a nudge right now */
  needsNudge: number;
  snoozed: number;
  priority: number;
  byCategory: { category: Category; count: number }[];
}

export interface WeeklyInsights {
  completions: number;
  completionsByType: Record<Item["type"], number>;
  completionsByCategory: { category: Category; count: number }[];
  streakDays: number;
  busiestDay: string | null;
}

export function computeTodaySummary(
  items: Item[],
  categories: Category[],
): TodaySummary {
  const pending = items.filter((i) => i.status === "pending");
  const overdue = pending.filter(
    (i) => i.type !== "routine" && isOverdue(i),
  ).length;
  const dueToday = pending.filter(
    (i) => i.type !== "routine" && isDueToday(i) && !isOverdue(i),
  ).length;
  const routines = items.filter(
    (i) =>
      i.type === "routine" &&
      i.status === "pending" &&
      (isDueToday(i) || isOverdue(i)),
  ).length;
  const followUps = items.filter(
    (i) => i.type === "follow-up" && i.status === "pending",
  ).length;
  const snoozed = items.filter((i) => i.status === "snoozed").length;
  const priority = pending.filter((i) => i.priority).length;

  const byCategory = categories
    .map((category) => ({
      category,
      count: pending.filter((i) => i.categoryId === category.id).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    overdue,
    dueToday,
    routines,
    openThreads: followUps,
    needsNudge: countNeedsChase(items),
    snoozed,
    priority,
    byCategory,
  };
}

export function computeWeeklyInsights(
  completions: CompletionLog[],
  categories: Category[],
  weekStartsOnMonday: boolean,
): WeeklyInsights {
  const now = new Date();
  const weekStart = startOfWeek(now, {
    weekStartsOn: weekStartsOnMonday ? 1 : 0,
  });
  const weekEnd = endOfWeek(now, {
    weekStartsOn: weekStartsOnMonday ? 1 : 0,
  });

  const thisWeek = completions.filter((c) =>
    isWithinInterval(parseISO(c.completedAt), {
      start: weekStart,
      end: weekEnd,
    }),
  );

  const completionsByType: Record<Item["type"], number> = {
    deadline: 0,
    routine: 0,
    "follow-up": 0,
    note: 0,
    project: 0,
  };
  for (const c of thisWeek) {
    completionsByType[c.itemType]++;
  }

  const completionsByCategory = categories
    .map((category) => ({
      category,
      count: thisWeek.filter((c) => c.categoryId === category.id).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const dayCounts = new Map<string, number>();
  for (const c of thisWeek) {
    const day = parseISO(c.completedAt).toDateString();
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  let busiestDay: string | null = null;
  let maxCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > maxCount) {
      maxCount = count;
      busiestDay = day;
    }
  }

  let streakDays = 0;
  for (let i = 0; i < 30; i++) {
    const day = subDays(now, i);
    const hasCompletion = completions.some(
      (c) => parseISO(c.completedAt).toDateString() === day.toDateString(),
    );
    if (hasCompletion) streakDays++;
    else if (i > 0) break;
  }

  return {
    completions: thisWeek.length,
    completionsByType,
    completionsByCategory,
    streakDays,
    busiestDay,
  };
}
