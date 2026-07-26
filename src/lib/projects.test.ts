import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import {
  computeProgress,
  getChildren,
  getRootProjects,
  isContainer,
  nextChildSortOrder,
} from "./projects";

describe("projects", () => {
  const parent = createItem({
    title: "Outreach campaign",
    type: "project",
    categoryId: "personal",
    goalCount: 5,
  });

  it("identifies containers", () => {
    expect(isContainer(parent)).toBe(true);
    expect(isContainer(createItem({ title: "x" }))).toBe(false);
  });

  it("lists root projects excluding a category when asked", () => {
    const workFolder = createItem({
      title: "Client work",
      type: "project",
      categoryId: "work",
    });
    const personal = createItem({
      title: "Side project",
      type: "project",
      categoryId: "personal",
    });
    const roots = getRootProjects([parent, workFolder, personal], {
      excludeCategoryId: "work",
    });
    expect(roots.map((p) => p.title).sort()).toEqual(
      ["Outreach campaign", "Side project"].sort(),
    );
  });

  it("computes progress against goal", () => {
    const c1 = {
      ...createItem({ title: "A", parentId: parent.id }),
      status: "done" as const,
    };
    const c2 = createItem({ title: "B", parentId: parent.id });
    const progress = computeProgress(parent, [c1, c2]);
    expect(progress.done).toBe(1);
    expect(progress.goal).toBe(5);
    expect(progress.label).toBe("1 / 5 goal");
    expect(progress.percent).toBe(20);
  });

  it("filters active children", () => {
    const active = createItem({ title: "Todo", parentId: parent.id });
    const done = {
      ...createItem({ title: "Done", parentId: parent.id }),
      status: "done" as const,
    };
    expect(getChildren([active, done], parent.id)).toHaveLength(1);
  });

  it("assigns next child sort order", () => {
    const a = {
      ...createItem({ title: "a", parentId: parent.id }),
      sortOrder: 2,
    };
    const b = createItem({ title: "b", parentId: parent.id });
    expect(nextChildSortOrder([a, b], parent.id)).toBe(3);
  });
});
