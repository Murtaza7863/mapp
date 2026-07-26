import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import {
  getChildGroup,
  groupChildrenBySubgroup,
  parseContainerQuickAdd,
} from "./containers";

describe("containers", () => {
  it("reads childGroup with schoolKind fallback", () => {
    expect(
      getChildGroup(createItem({ title: "x", childGroup: "Sponsors" })),
    ).toBe("Sponsors");
    expect(getChildGroup(createItem({ title: "x", schoolKind: "exam" }))).toBe(
      "Exam",
    );
  });

  it("groups children by area subgroups", () => {
    const groups = groupChildrenBySubgroup(
      [
        createItem({ title: "a", childGroup: "Homework" }),
        createItem({ title: "b", childGroup: "Exam" }),
        createItem({ title: "c" }),
      ],
      ["Homework", "Exam"],
    );
    expect(groups.get("Homework")).toHaveLength(1);
    expect(groups.get("Exam")).toHaveLength(1);
    expect(groups.get("__other__")).toHaveLength(1);
  });

  it("parses folder quick add with subgroup", () => {
    const parsed = parseContainerQuickAdd(
      "Fall Outreach Sponsors: Email Google",
      ["Sponsors", "Events"],
    );
    expect(parsed?.folderName).toBe("Fall Outreach");
    expect(parsed?.childGroup).toBe("Sponsors");
    expect(parsed?.taskTitle).toBe("Email Google");
  });
});
