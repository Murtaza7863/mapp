import type { Category, CompletionLog, Item } from "../types";

import { buildEventDeadlineEntries, deadlineUrgency } from "./event-deadlines";
import { isOverdue } from "./dates";
import { filterStaleThreads, needsChase } from "./pipeline";
import { computeWeeklyInsights } from "./stats";

export interface WeeklyReviewSection {
  id: string;
  title: string;
  description: string;
  count: number;
  itemIds: string[];
}

export interface WeeklyReview {
  wins: number;
  sections: WeeklyReviewSection[];
}

export function buildWeeklyReview(
  items: Item[],
  completions: CompletionLog[],
  categories: Category[],
  weekStartsOnMonday: boolean,
  now = new Date(),
): WeeklyReview {
  const insights = computeWeeklyInsights(
    completions,
    categories,
    weekStartsOnMonday,
  );

  const openThreads = items.filter(
    (i) => i.type === "follow-up" && i.status !== "done",
  );
  const stale = filterStaleThreads(openThreads);
  const nudgeIds = openThreads
    .filter((i) => needsChase(i, now))
    .map((i) => i.id);
  const overdueIds = items
    .filter((i) => i.status === "pending" && isOverdue(i))
    .map((i) => i.id);
  const prepIds = buildEventDeadlineEntries(items)
    .filter((e) => deadlineUrgency(e.daysUntilPrep) !== "low")
    .map((e) => e.item.id);

  const coldAreas = categories
    .filter(
      (cat) =>
        !insights.completionsByCategory.some((c) => c.category.id === cat.id),
    )
    .map((c) => c.id);

  const sections: WeeklyReviewSection[] = [
    {
      id: "stale",
      title: "Stale threads",
      description: "No contact in a while — send a bump or revisit",
      count: stale.length,
      itemIds: stale.map((i) => i.id),
    },
    {
      id: "nudge",
      title: "Need a nudge",
      description: "Stage-aware follow-through waiting on you",
      count: nudgeIds.length,
      itemIds: nudgeIds,
    },
    {
      id: "overdue",
      title: "Overdue tasks",
      description: "Reschedule or knock these out",
      count: overdueIds.length,
      itemIds: overdueIds,
    },
    {
      id: "prep",
      title: "Event prep due soon",
      description: "Threads with upcoming prep deadlines",
      count: prepIds.length,
      itemIds: prepIds,
    },
    {
      id: "cold",
      title: "Quiet areas",
      description: "No completions this week — anything to revive?",
      count: coldAreas.length,
      itemIds: coldAreas,
    },
  ].filter((s) => s.count > 0);

  return { wins: insights.completions, sections };
}

export function shouldSuggestWeeklyReview(
  now = new Date(),
  weekStartsOnMonday = false,
): boolean {
  const day = now.getDay();
  if (weekStartsOnMonday) return day === 0 || day === 6;
  return day === 0 || day === 6;
}
