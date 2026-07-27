import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { computeDailyBriefing } from "./briefing";

describe("computeDailyBriefing", () => {
  it("reports nudge and overdue in headline", () => {
    const items = [
      createItem({
        title: "Late",
        dueAt: "2026-07-20T09:00:00",
      }),
      createItem({
        title: "Waiting",
        type: "follow-up",
        pipelineStage: "waiting",
        lastContactAt: "2026-07-10T12:00:00",
      }),
    ];
    const briefing = computeDailyBriefing(
      items,
      new Date("2026-07-26T12:00:00"),
    );
    expect(briefing.needsNudge).toBe(1);
    expect(briefing.overdue).toBe(1);
    expect(briefing.headline).toContain("nudge");
    expect(briefing.headline).toContain("overdue");
  });

  it("is clear when nothing urgent", () => {
    const briefing = computeDailyBriefing([], new Date("2026-07-26T12:00:00"));
    expect(briefing.headline).toBe("You're clear");
  });

  it("does not claim you're clear when work is scheduled ahead", () => {
    const items = [
      createItem({ title: "Essay", dueAt: "2026-08-05T09:00:00" }),
      createItem({ title: "Rent", dueAt: "2026-08-01T09:00:00" }),
    ];
    const briefing = computeDailyBriefing(
      items,
      new Date("2026-07-26T12:00:00"),
    );
    expect(briefing.upcoming).toBe(2);
    expect(briefing.headline).toBe("Nothing due today");
    expect(briefing.subline).toContain("2 coming up");
  });

  it("agrees in number for a single nudge", () => {
    const items = [
      createItem({
        title: "Waiting",
        type: "follow-up",
        pipelineStage: "waiting",
        lastContactAt: "2026-07-10T12:00:00",
      }),
    ];
    const briefing = computeDailyBriefing(
      items,
      new Date("2026-07-26T12:00:00"),
    );
    expect(briefing.headline).toBe("1 follow-up needs a nudge");
  });
});
