import { describe, expect, it } from "vitest";

import type { Category, CompletionLog } from "../types";
import { createItem } from "./items";
import { computeTodaySummary, computeWeeklyInsights } from "./stats";

const categories: Category[] = [
  { id: "c1", name: "Work", color: "#3b82f6", icon: "briefcase", sortOrder: 0 },
  { id: "c2", name: "Personal", color: "#22c55e", icon: "home", sortOrder: 1 },
];

describe("stats", () => {
  it("summarizes today counts", () => {
    const items = [
      createItem({
        title: "Late task",
        categoryId: "c1",
        dueAt: new Date(Date.now() - 3600000).toISOString(),
      }),
      createItem({
        title: "Routine",
        type: "routine",
        categoryId: "c2",
        dueAt: new Date().toISOString(),
      }),
      createItem({ title: "Waiting", type: "follow-up", categoryId: "c1" }),
    ];
    const summary = computeTodaySummary(items, categories);
    expect(summary.overdue).toBe(1);
    expect(summary.routines).toBe(1);
    expect(summary.openThreads).toBe(1);
    expect(summary.needsNudge).toBe(0);
    expect(summary.byCategory.length).toBeGreaterThan(0);
  });

  it("computes weekly insights", () => {
    const completions: CompletionLog[] = [
      {
        id: "1",
        itemId: "a",
        itemTitle: "Done thing",
        itemType: "deadline",
        categoryId: "c1",
        completedAt: new Date().toISOString(),
      },
    ];
    const insights = computeWeeklyInsights(completions, categories, false);
    expect(insights.completions).toBe(1);
    expect(insights.completionsByType.deadline).toBe(1);
  });
});
