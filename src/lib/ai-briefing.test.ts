import { describe, expect, it, vi } from "vitest";

import { fetchAiBriefing } from "./ai-briefing";
import type { DailyBriefing } from "./briefing";

vi.mock("./brain-dump/llm-engine", () => ({
  generateAiInsight: vi.fn(),
}));

describe("fetchAiBriefing", () => {
  const briefing: DailyBriefing = {
    overdue: 2,
    dueToday: 1,
    upcoming: 0,
    needsNudge: 3,
    urgentPrep: 0,
    snoozed: 0,
    headline: "2 overdue",
    subline: "1 due today",
  };

  it("returns rules fallback when AI disabled", async () => {
    const result = await fetchAiBriefing([], briefing, { preferAi: false });
    expect(result.source).toBe("rules");
    expect(result.insight).toMatch(/overdue/i);
  });
});
