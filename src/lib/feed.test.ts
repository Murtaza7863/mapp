import { describe, expect, it, vi } from "vitest";

import {
  buildCommandFeed,
  filterFeedByFocus,
  groupFeedByBucket,
} from "./feed";
import { createItem } from "./items";

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

  it("includes urgent prep deadlines in feed", () => {
    const now = new Date("2026-07-26T12:00:00");
    const thread = createItem({
      title: "Summit prep",
      type: "follow-up",
      linkedEventAt: new Date("2026-08-10T09:00:00").toISOString(),
    });
    vi.setSystemTime(now);
    const feed = buildCommandFeed([thread], { now });
    vi.useRealTimers();
    expect(feed.some((e) => e.bucket === "prep")).toBe(true);
  });

  it("surfaces chase threads as the first bucket with a reason", () => {
    const now = new Date("2026-07-26T12:00:00");
    const stale = createItem({
      title: "Outreach",
      type: "follow-up",
      pipelineStage: "waiting",
      contactName: "Acme",
      lastContactAt: "2026-07-15T12:00:00",
    });
    const today = createItem({
      title: "Ship notes",
      dueAt: new Date("2026-07-26T14:00:00").toISOString(),
    });

    vi.setSystemTime(now);
    const feed = buildCommandFeed([stale, today], { now });
    vi.useRealTimers();

    expect(feed[0].bucket).toBe("chase");
    expect(feed[0].item.title).toBe("Outreach");
    expect(feed[0].reason).toMatch(/bump|reply/i);

    const grouped = groupFeedByBucket(feed);
    expect(grouped.get("chase")?.length).toBe(1);
    expect(grouped.get("today")?.length).toBe(1);
  });

  it("filters feed by summary focus", () => {
    const now = new Date("2026-07-26T12:00:00");
    const overdue = createItem({
      title: "Late",
      dueAt: new Date("2026-07-25T09:00:00").toISOString(),
    });
    const today = createItem({
      title: "Now",
      dueAt: new Date("2026-07-26T14:00:00").toISOString(),
      priority: true,
    });

    vi.setSystemTime(now);
    const feed = buildCommandFeed([overdue, today], { now });
    vi.useRealTimers();

    expect(filterFeedByFocus(feed, "overdue").map((e) => e.item.title)).toEqual(
      ["Late"],
    );
    expect(
      filterFeedByFocus(feed, "priority").map((e) => e.item.title),
    ).toEqual(["Now"]);
  });
});
