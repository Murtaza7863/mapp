import { describe, expect, it, vi } from "vitest";

import { createItem } from "./items";
import { buildCommandFeed } from "./feed";

describe("buildCommandFeed", () => {
  it("orders overdue before today and includes routines", () => {
    const now = new Date("2026-07-26T12:00:00");
    const overdue = createItem({
      title: "Late",
      dueAt: new Date("2026-07-25T09:00:00").toISOString(),
    });
    const today = createItem({
      title: "Now",
      dueAt: new Date("2026-07-26T14:00:00").toISOString(),
    });
    const routine = createItem({
      title: "Daily",
      type: "routine",
      dueAt: new Date("2026-07-26T08:00:00").toISOString(),
      recurrence: { frequency: "daily" },
    });
    const routineLater = createItem({
      title: "Later routine",
      type: "routine",
      dueAt: new Date("2026-07-28T08:00:00").toISOString(),
      recurrence: { frequency: "daily" },
    });

    vi.setSystemTime(now);
    const feed = buildCommandFeed([overdue, today, routine, routineLater], {
      priorityOnly: false,
    });
    vi.useRealTimers();

    expect(feed.map((e) => e.item.title)).toEqual(["Late", "Now", "Daily"]);
    expect(feed[0].bucket).toBe("overdue");
  });
});
