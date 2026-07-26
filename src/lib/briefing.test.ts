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
});
