import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { getSchoolModules, parseSchoolQuickAdd } from "./school";

describe("school", () => {
  const schoolId = "school-cat";

  it("lists school modules", () => {
    const mod = createItem({
      title: "CS101",
      type: "project",
      categoryId: schoolId,
    });
    const other = createItem({
      title: "Outreach",
      type: "project",
      categoryId: "smubia",
    });
    expect(getSchoolModules([mod, other], schoolId)).toHaveLength(1);
  });

  it("parses school quick add", () => {
    const parsed = parseSchoolQuickAdd("CS101 homework: Read ch 4");
    expect(parsed).toEqual({
      moduleName: "CS101",
      childGroup: "Homework",
      taskTitle: "Read ch 4",
    });
  });
});
