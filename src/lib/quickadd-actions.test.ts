import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { applyQuickAdd } from "./quickadd-actions";

describe("applyQuickAdd", () => {
  const categories = [
    {
      id: "work",
      name: "Work",
      color: "#3b82f6",
      icon: "briefcase",
      sortOrder: 0,
      subgroups: ["Tasks", "Projects"],
    },
    {
      id: "personal",
      name: "Personal",
      color: "#22c55e",
      icon: "home",
      sortOrder: 1,
    },
  ];

  it("creates folder and task from subgroup syntax", async () => {
    const created: ReturnType<typeof createItem>[] = [];
    const addItem = async (input: Parameters<typeof createItem>[0]) => {
      const item = createItem(input);
      created.push(item);
      return item;
    };

    await applyQuickAdd(
      {
        title: "Q3 planning tasks: Draft roadmap",
        priority: false,
      },
      { categories, items: [], addItem },
    );

    expect(created).toHaveLength(2);
    expect(created[0].type).toBe("project");
    expect(created[0].title).toBe("Q3 planning");
    expect(created[1].parentId).toBe(created[0].id);
    expect(created[1].childGroup).toBe("Tasks");
  });

  it("seeds follow-up defaults", async () => {
    const created: ReturnType<typeof createItem>[] = [];
    const addItem = async (input: Parameters<typeof createItem>[0]) => {
      const item = createItem(input);
      created.push(item);
      return item;
    };

    await applyQuickAdd(
      {
        title: "Acme Corp follow-up",
        type: "follow-up",
        categoryId: "personal",
        priority: false,
      },
      { categories, items: [], addItem },
    );

    expect(created[0].pipelineStage).toBe("outreach");
    expect(created[0].lastContactAt).toBeTruthy();
  });
});
