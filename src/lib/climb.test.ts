import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { buildClimbEntries, gpdUrgency } from "./climb";

describe("climb", () => {
  it("builds GPD entries for CLIMB follow-ups with linked events", () => {
    const climbId = "climb-1";
    const item = createItem({
      title: "Spring showcase",
      type: "follow-up",
      categoryId: climbId,
      linkedEventAt: "2026-10-01T00:00:00.000Z",
    });

    const entries = buildClimbEntries([item], climbId);
    expect(entries).toHaveLength(1);
    expect(entries[0].daysUntilEvent).toBeGreaterThan(0);
    expect(entries[0].daysUntilGpd).toBeLessThan(entries[0].daysUntilEvent);
  });

  it("flags urgent GPD deadlines", () => {
    expect(gpdUrgency(3)).toBe("high");
    expect(gpdUrgency(14)).toBe("medium");
    expect(gpdUrgency(30)).toBe("low");
  });
});
