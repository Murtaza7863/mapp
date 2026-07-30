import { beforeEach, describe, expect, it } from "vitest";

import type { Category } from "../types";

import { db } from "../db";
import { sortCategories } from "./useCategories";

function cat(partial: Partial<Category> & { id: string }): Category {
  return {
    name: partial.id,
    color: "#000",
    icon: "folder",
    sortOrder: 0,
    ...partial,
  } as Category;
}

describe("category ordering", () => {
  beforeEach(async () => {
    await db.categories.clear();
  });

  it("keeps areas whose sortOrder is missing or NaN", () => {
    const sorted = sortCategories([
      cat({ id: "c", name: "Third", sortOrder: 2 }),
      cat({ id: "b", name: "Ghost", sortOrder: undefined as never }),
      cat({ id: "a", name: "First", sortOrder: 0 }),
      cat({ id: "d", name: "Broken", sortOrder: NaN }),
    ]);

    expect(sorted.map((c) => c.name)).toEqual([
      "First",
      "Third",
      "Broken",
      "Ghost",
    ]);
  });

  // Regression: db.categories.orderBy("sortOrder") silently drops rows whose
  // indexed key is missing or NaN, which made areas vanish from the picker.
  it("reads every stored area even when an index key is unusable", async () => {
    await db.categories.bulkAdd([
      cat({ id: "a", name: "Work", sortOrder: 0 }),
      cat({ id: "b", name: "Ghost", sortOrder: undefined as never }),
      cat({ id: "c", name: "Broken", sortOrder: NaN }),
    ]);

    const viaIndex = await db.categories.orderBy("sortOrder").toArray();
    const viaScan = sortCategories(await db.categories.toArray());

    expect(viaIndex).toHaveLength(1);
    expect(viaScan.map((c) => c.name)).toEqual(["Work", "Broken", "Ghost"]);
  });
});
