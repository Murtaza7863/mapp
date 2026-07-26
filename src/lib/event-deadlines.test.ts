import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { buildEventDeadlineEntries, deadlineUrgency } from "./event-deadlines";

describe("event-deadlines", () => {
  it("builds prep deadline entries for follow-ups with linked events", () => {
    const item = createItem({
      type: "follow-up",
      title: "Conference booth",
      linkedEventAt: "2027-06-01T00:00:00.000Z",
    });
    const entries = buildEventDeadlineEntries([item]);
    expect(entries).toHaveLength(1);
    expect(entries[0].item.id).toBe(item.id);
    expect(entries[0].daysUntilEvent).toBeGreaterThan(0);
  });

  it("flags urgent prep deadlines", () => {
    expect(deadlineUrgency(3)).toBe("high");
    expect(deadlineUrgency(14)).toBe("medium");
    expect(deadlineUrgency(30)).toBe("low");
  });
});
