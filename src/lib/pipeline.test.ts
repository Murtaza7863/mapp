import { describe, expect, it, vi } from "vitest";

import { createItem } from "./items";
import { buildSuggestions, gpdDueFromEvent, needsChase } from "./pipeline";

describe("pipeline", () => {
  it("computes GPD due 10 weeks before event", () => {
    const due = gpdDueFromEvent("2026-12-01T00:00:00");
    expect(due.toISOString().slice(0, 10)).toBe("2026-09-22");
  });

  it("chases deferred items when checkBackAt is due", () => {
    vi.setSystemTime(new Date("2026-07-26T12:00:00"));
    const item = createItem({
      title: "Revisit Google deal",
      type: "follow-up",
      pipelineStage: "deferred",
      checkBackAt: "2026-07-26T09:00:00",
      contactName: "Google",
    });
    expect(needsChase(item)).toBe(true);
    const suggestions = buildSuggestions([item]);
    expect(suggestions[0].reason).toContain("look back");
    vi.useRealTimers();
  });

  it("chases stale waiting threads", () => {
    vi.setSystemTime(new Date("2026-07-26T12:00:00"));
    const item = createItem({
      title: "Outreach",
      type: "follow-up",
      pipelineStage: "waiting",
      contactName: "Acme",
      lastContactAt: "2026-07-15T12:00:00",
    });
    expect(needsChase(item)).toBe(true);
    vi.useRealTimers();
  });
});
