import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { syncNotificationSchedule } from "../lib/notifications";
import type { Category } from "../types";

/**
 * Dexie's orderBy() drops rows whose indexed key is missing or NaN, so a single
 * bad sortOrder (older data, an import, a hand-edited backup) would silently
 * hide areas — including newly added ones. Read every row and sort in memory.
 */
export function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => {
    const ao = Number.isFinite(a.sortOrder)
      ? a.sortOrder
      : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(b.sortOrder)
      ? b.sortOrder
      : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

export function useCategories() {
  const categories = useLiveQuery(
    async () => sortCategories(await db.categories.toArray()),
    [],
    [] as Category[],
  );

  const addCategory = async (
    data: Omit<Category, "id" | "sortOrder">,
  ): Promise<Category> => {
    const name = data.name.trim();
    if (!name) throw new Error("Area needs a name.");

    // Read fresh: the live query may not have caught up, and a stale/NaN
    // sortOrder here would make the new area unsortable.
    const existing = await db.categories.toArray();
    if (
      existing.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    ) {
      throw new Error(`“${name}” already exists.`);
    }

    const maxOrder = existing.reduce(
      (m, c) => (Number.isFinite(c.sortOrder) ? Math.max(m, c.sortOrder) : m),
      -1,
    );
    const category: Category = {
      ...data,
      name,
      id: uuidv4(),
      sortOrder: maxOrder + 1,
    };
    await db.categories.add(category);
    return category;
  };

  const updateCategory = async (id: string, changes: Partial<Category>) => {
    await db.categories.update(id, changes);
  };

  const deleteCategory = async (id: string) => {
    const all = await db.categories.toArray();
    if (all.length <= 1) {
      throw new Error("You need at least one area.");
    }
    const itemCount = await db.items.where("categoryId").equals(id).count();
    const fallback = all.find((c) => c.id !== id);
    if (!fallback) return;

    if (itemCount > 0) {
      await db.items.where("categoryId").equals(id).modify({
        categoryId: fallback.id,
      });
    }

    await db.categories.delete(id);
    await syncNotificationSchedule();
  };

  const moveCategory = async (id: string, direction: "up" | "down") => {
    const sorted = sortCategories(await db.categories.toArray());
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Rewrite the whole run so any non-finite sortOrder heals itself.
    await db.transaction("rw", db.categories, async () => {
      const reordered = [...sorted];
      [reordered[idx], reordered[swapIdx]] = [
        reordered[swapIdx],
        reordered[idx],
      ];
      await Promise.all(
        reordered.map((c, i) => db.categories.update(c.id, { sortOrder: i })),
      );
    });
  };

  const getCategory = (id: string) => categories.find((c) => c.id === id);

  return {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    moveCategory,
    getCategory,
  };
}
