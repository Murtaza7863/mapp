import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { findTriageCandidates } from "./triage";
import { computeWrapUpSummary } from "./wrapup";

describe("triage", () => {
  it("finds fresh undated captures", () => {
    const fresh = {
      ...createItem({ title: "Random thought" }),
      createdAt: new Date("2026-07-26T10:00:00").toISOString(),
    };
    const dated = {
      ...createItem({
        title: "Due thing",
        dueAt: new Date("2026-07-27T09:00:00").toISOString(),
      }),
      createdAt: new Date("2026-07-26T10:00:00").toISOString(),
    };
    const candidates = findTriageCandidates(
      [fresh, dated],
      new Date("2026-07-26T12:00:00"),
    );
    expect(candidates.map((i) => i.title)).toEqual(["Random thought"]);
  });
});

describe("wrapup", () => {
  it("summarizes end of day", () => {
    const summary = computeWrapUpSummary(
      [
        createItem({
          title: "Late",
          dueAt: "2026-07-25T09:00:00",
        }),
      ],
      [
        {
          id: "1",
          itemId: "a",
          itemTitle: "Done",
          itemType: "deadline",
          categoryId: "c1",
          completedAt: new Date("2026-07-26T18:00:00").toISOString(),
        },
      ],
      new Date("2026-07-26T20:00:00"),
    );
    expect(summary.doneToday).toBe(1);
    expect(summary.parkable.length).toBe(1);
  });
});
