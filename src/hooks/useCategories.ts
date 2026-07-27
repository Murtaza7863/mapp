import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { syncNotificationSchedule } from "../lib/notifications";
import type { Category } from "../types";

export function useCategories() {
  const categories =
    useLiveQuery(() => db.categories.orderBy("sortOrder").toArray(), []) ?? [];

  const addCategory = async (
    data: Omit<Category, "id" | "sortOrder">,
  ): Promise<Category> => {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), -1);
    const category: Category = {
      ...data,
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
    if (categories.length <= 1) {
      throw new Error("You need at least one area.");
    }
    const itemCount = await db.items.where("categoryId").equals(id).count();
    const fallback = categories.find((c) => c.id !== id);
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
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    await db.categories.update(a.id, { sortOrder: b.sortOrder });
    await db.categories.update(b.id, { sortOrder: a.sortOrder });
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
