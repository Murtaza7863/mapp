import { describe, expect, it } from "vitest";

import { mergePlotProposals } from "./merge-proposals";
import type { ProposedItem } from "./types";

function item(
  partial: Partial<ProposedItem> & Pick<ProposedItem, "title">,
): ProposedItem {
  return {
    id: partial.id ?? "1",
    type: partial.type ?? "deadline",
    priority: partial.priority ?? false,
    selected: true,
    ...partial,
  };
}

describe("mergePlotProposals", () => {
  it("returns llm when rules empty", () => {
    const llm = [item({ title: "Email prof", type: "follow-up" })];
    expect(mergePlotProposals([], llm)).toEqual(llm);
  });

  it("returns rules when llm empty", () => {
    const rules = [item({ title: "Gym", type: "routine" })];
    expect(mergePlotProposals(rules, [])).toEqual(rules);
  });

  it("merges non-overlapping items from both", () => {
    const rules = [item({ id: "r1", title: "Gym friday" })];
    const llm = [item({ id: "l1", title: "Email prof", type: "follow-up" })];
    const merged = mergePlotProposals(rules, llm);
    expect(merged).toHaveLength(2);
  });

  it("prefers llm item with due date over rules duplicate", () => {
    const rules = [item({ id: "r1", title: "Pay rent" })];
    const llm = [
      item({
        id: "l1",
        title: "Pay rent",
        dueAt: "2026-07-27T13:00:00.000Z",
        priority: true,
      }),
    ];
    const merged = mergePlotProposals(rules, llm);
    expect(merged).toHaveLength(1);
    expect(merged[0].dueAt).toBeTruthy();
    expect(merged[0].priority).toBe(true);
  });

  it("dedupes similar titles", () => {
    const rules = [
      item({ id: "r1", title: "Follow up acme", contactName: "Acme" }),
    ];
    const llm = [
      item({
        id: "l1",
        title: "Follow up — Acme Corp",
        type: "follow-up",
        contactName: "Acme Corp",
        dueAt: "2026-07-28T09:00:00.000Z",
      }),
    ];
    const merged = mergePlotProposals(rules, llm);
    expect(merged).toHaveLength(1);
    expect(merged[0].dueAt).toBeTruthy();
  });
});
