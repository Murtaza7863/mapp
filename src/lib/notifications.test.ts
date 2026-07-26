import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { buildScheduledNotifications } from "./notifications";

describe("buildScheduledNotifications", () => {
  const now = new Date("2026-07-26T12:00:00").getTime();

  it("includes future reminders only", () => {
    const future = createItem({
      title: "Later",
      dueAt: new Date("2026-07-26T14:00:00").toISOString(),
    });
    const past = createItem({
      title: "Missed",
      dueAt: new Date("2026-07-26T10:00:00").toISOString(),
    });

    const scheduled = buildScheduledNotifications([future, past], now);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].title).toBe("Later");
  });

  it("skips notes", () => {
    const note = createItem({
      title: "Note",
      type: "note",
      dueAt: new Date("2026-07-26T14:00:00").toISOString(),
    });
    expect(buildScheduledNotifications([note], now)).toHaveLength(0);
  });

  it("schedules look-back reminders for threads", () => {
    const thread = createItem({
      title: "Revisit Google deal",
      type: "follow-up",
      checkBackAt: new Date("2026-07-27T09:00:00").toISOString(),
    });
    const scheduled = buildScheduledNotifications([thread], now);
    expect(scheduled.some((s) => s.id.endsWith("-checkback"))).toBe(true);
  });

  it("schedules chase nudges for stale threads", () => {
    const thread = createItem({
      title: "Outreach",
      type: "follow-up",
      pipelineStage: "waiting",
      lastContactAt: "2026-07-10T12:00:00",
    });
    const scheduled = buildScheduledNotifications([thread], now);
    expect(scheduled.some((s) => s.id.endsWith("-chase"))).toBe(true);
  });
});
