import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db, seedDatabase } from "../db";
import { createCompletionLog } from "./completions";
import { exportData, importData } from "./export";
import { createItem } from "./items";

describe("export/import", () => {
  beforeAll(async () => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    await db.delete();
    await db.open();
    await seedDatabase();
  });

  beforeEach(async () => {
    await db.items.clear();
    await db.completions.clear();
  });

  it("exports and re-imports all data including completions", async () => {
    const categories = await db.categories.toArray();
    const item = createItem({
      title: "Backup test",
      categoryId: categories[0].id,
      dueAt: new Date().toISOString(),
    });
    await db.items.add(item);
    await db.completions.add(
      createCompletionLog(item, new Date().toISOString()),
    );

    const bundle = await exportData();
    expect(bundle.version).toBe(2);
    expect(bundle.items).toHaveLength(1);
    expect(bundle.completions).toHaveLength(1);

    await db.items.clear();
    await db.completions.clear();

    await importData(bundle, true);
    expect(await db.items.count()).toBe(1);
    expect(await db.completions.count()).toBe(1);
  });

  it("rejects unsupported export versions", async () => {
    const bundle = await exportData();
    await expect(
      importData({ ...bundle, version: 99 as 2 }, true),
    ).rejects.toThrow("Unsupported export version");
  });
});
