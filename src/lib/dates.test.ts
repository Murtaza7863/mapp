import { describe, expect, it } from "vitest";

import { getNextOccurrence, isDueToday, isOverdue, isUpcoming } from "./dates";
import type { Item } from "../types";
import { createItem } from "./items";

function item(overrides: Partial<Item>): Item {
  return { ...createItem({ title: "Test" }), ...overrides };
}

describe("dates", () => {
  it("detects overdue pending items", () => {
    const overdue = item({
      dueAt: new Date(Date.now() - 3600000).toISOString(),
      status: "pending",
    });
    expect(isOverdue(overdue)).toBe(true);
    expect(isOverdue(item({ status: "done" }))).toBe(false);
  });

  it("detects due today", () => {
    const today = item({
      dueAt: new Date().toISOString(),
      status: "pending",
    });
    expect(isDueToday(today)).toBe(true);
  });

  it("hides snoozed items until snooze expires", () => {
    const snoozed = item({
      dueAt: new Date().toISOString(),
      status: "pending",
      snoozedUntil: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(isDueToday(snoozed)).toBe(false);
  });

  it("finds upcoming items within 7 days", () => {
    const upcoming = item({
      dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      status: "pending",
    });
    expect(isUpcoming(upcoming)).toBe(true);
    expect(
      isUpcoming(
        item({ dueAt: new Date(Date.now() + 30 * 86400000).toISOString() }),
      ),
    ).toBe(false);
  });

  it("computes next daily occurrence", () => {
    const from = new Date("2026-07-25T09:00:00");
    const next = getNextOccurrence({ frequency: "daily" }, from);
    expect(next.getDate()).toBe(26);
    expect(next.getHours()).toBe(9);
  });

  it("computes next weekday occurrence skipping weekends", () => {
    const friday = new Date("2026-07-24T09:00:00"); // Friday
    const next = getNextOccurrence({ frequency: "weekdays" }, friday);
    expect(next.getDay()).toBe(1); // Monday
  });
});
