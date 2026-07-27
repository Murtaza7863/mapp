import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db, seedDatabase } from "../../db";
import type { Category } from "../../types";
import { createItem } from "../items";

import { applyProposals } from "./apply-proposals";
import { parseBrainDump } from "./parse-dump";

const NOW = new Date(2026, 6, 26, 10, 0, 0);

vi.setSystemTime(NOW);

describe("plot agent apply", () => {
  let categories: Category[] = [];
  const items: ReturnType<typeof createItem>[] = [];

  beforeAll(async () => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    await db.delete();
    await db.open();
    await seedDatabase();
    categories = await db.categories.toArray();
  });

  beforeEach(async () => {
    await db.items.clear();
    items.length = 0;
  });

  const ctx = () => ({
    categories: [...categories],
    items: [...items],
    addItem: async (
      input: Parameters<typeof createItem>[0] & { title: string },
    ) => {
      const item = createItem(input);
      await db.items.add(item);
      items.push(item);
      return item;
    },
    addCategory: async (
      data: Omit<Category, "id" | "sortOrder">,
    ): Promise<Category> => {
      const maxOrder = categories.reduce(
        (m, c) => Math.max(m, c.sortOrder),
        -1,
      );
      const cat: Category = {
        ...data,
        id: `cat-${Date.now()}-${Math.random()}`,
        sortOrder: maxOrder + 1,
      };
      await db.categories.add(cat);
      categories.push(cat);
      return cat;
    },
    updateCategory: async (id: string, changes: Partial<Category>) => {
      await db.categories.update(id, changes);
      const idx = categories.findIndex((c) => c.id === id);
      if (idx >= 0) categories[idx] = { ...categories[idx], ...changes };
    },
  });

  it("creates area, folder, subgroup task from structured plot", async () => {
    const dump =
      "new area ATLAS (sponsors) Fall Outreach sponsors: follow up with Acme Corp by friday";
    const { items: proposals } = await parseBrainDump(dump, {
      categories,
      preferLlm: false,
    });
    expect(proposals).toHaveLength(1);

    const created = await applyProposals(proposals, ctx());
    expect(created.items).toHaveLength(1);

    const area = categories.find((c) => c.name === "ATLAS");
    expect(area).toBeTruthy();
    expect(area?.subgroups).toEqual(expect.arrayContaining(["Sponsors"]));

    const folder = items.find(
      (i) => i.type === "project" && i.title === "Fall Outreach",
    );
    expect(folder).toBeTruthy();
    expect(created.items[0].parentId).toBe(folder?.id);
    expect(created.items[0].childGroup).toBe("Sponsors");
    expect(created.items[0].categoryId).toBe(area?.id);
  });

  it("creates area on for-tail when missing", async () => {
    const dump = "follow up with Acme Corp for ATLAS";
    const { items: proposals } = await parseBrainDump(dump, {
      categories,
      preferLlm: false,
    });
    await applyProposals(proposals, ctx());

    expect(categories.some((c) => c.name === "ATLAS")).toBe(true);
    const task = items.find((i) => i.type === "follow-up");
    expect(task?.categoryId).toBe(
      categories.find((c) => c.name === "ATLAS")?.id,
    );
  });
});
