import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { calendarEntriesForItem } from "./calendar";

describe("calendar", () => {
  it("includes prep and look-back dates for linked-event threads", () => {
    const item = createItem({
      title: "Submit proposal",
      type: "follow-up",
      linkedEventAt: new Date("2026-10-01T00:00:00").toISOString(),
      checkBackAt: new Date("2026-08-15T09:00:00").toISOString(),
      dueAt: new Date("2026-07-28T09:00:00").toISOString(),
    });

    const entries = calendarEntriesForItem(item);
    const kinds = entries.map((e) => e.kind).sort();
    expect(kinds).toEqual(["check-back", "due", "gpd"]);
  });
});
