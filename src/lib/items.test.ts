import { describe, expect, it } from "vitest";

import {
  completeItem,
  createItem,
  isActionable,
  snoozeItem,
  wakeSnoozedItem,
} from "./items";
import type { Item } from "../types";

describe("items", () => {
  it("creates a deadline item with defaults", () => {
    const item = createItem({ title: "Test task" });
    expect(item.title).toBe("Test task");
    expect(item.type).toBe("deadline");
    expect(item.status).toBe("pending");
    expect(item.priority).toBe(false);
    expect(item.id).toBeTruthy();
  });

  it("marks non-routine items done", () => {
    const item = createItem({ title: "Finish report", type: "deadline" });
    const done = completeItem(item);
    expect(done.status).toBe("done");
    expect(done.completedAt).toBeTruthy();
  });

  it("advances routine to next occurrence", () => {
    const item: Item = {
      ...createItem({
        title: "Daily standup",
        type: "routine",
        dueAt: new Date("2026-07-25T09:00:00").toISOString(),
        recurrence: { frequency: "daily" },
      }),
    };
    const next = completeItem(item);
    expect(next.status).toBe("pending");
    expect(next.dueAt).toBeTruthy();
    expect(new Date(next.dueAt!).getTime()).toBeGreaterThan(
      new Date(item.dueAt!).getTime(),
    );
    expect(next.completedAt).toBeTruthy();
  });

  it("snoozes and wakes items", () => {
    const item = createItem({ title: "Call back" });
    const until = new Date("2026-07-26T10:00:00");
    const snoozed = snoozeItem(item, until);
    expect(snoozed.status).toBe("snoozed");
    expect(snoozed.snoozedUntil).toBeTruthy();
    expect(snoozed.dueAt).toBe(until.toISOString());

    const awake = wakeSnoozedItem(snoozed);
    expect(awake.status).toBe("pending");
    expect(awake.snoozedUntil).toBeUndefined();
  });

  it("treats follow-ups and notes as non-actionable on Today", () => {
    expect(isActionable(createItem({ title: "x", type: "deadline" }))).toBe(
      true,
    );
    expect(isActionable(createItem({ title: "x", type: "follow-up" }))).toBe(
      false,
    );
    expect(isActionable(createItem({ title: "x", type: "note" }))).toBe(false);
    expect(isActionable(createItem({ title: "x", type: "project" }))).toBe(
      false,
    );
  });
});
