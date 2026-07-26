import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { getSettings } from "../db";
import { createCompletionLog } from "../lib/completions";
import {
  completeItem,
  createItem,
  reopenItem,
  snoozeItem,
  wakeSnoozedItem,
} from "../lib/items";
import { afterDataMutation } from "../lib/persistence";
import type { Item, ItemInput } from "../types";

export function useItems() {
  const itemsQuery = useLiveQuery(() => db.items.toArray(), []);
  const items = itemsQuery ?? [];
  const itemsLoading = itemsQuery === undefined;

  const addItem = async (input: Partial<ItemInput> & { title: string }) => {
    const settings = await getSettings();
    const item = createItem({
      ...input,
      reminderOffsetMinutes:
        input.reminderOffsetMinutes ?? settings.defaultReminderOffsetMinutes,
    });
    await db.items.add(item);
    void afterDataMutation();
    return item;
  };

  const updateItem = async (id: string, changes: Partial<Item>) => {
    await db.items.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    void afterDataMutation();
  };

  const deleteItem = async (id: string) => {
    const item = await db.items.get(id);
    await db.items.delete(id);
    void afterDataMutation();
    return item ?? null;
  };

  const deleteItemCascade = async (id: string) => {
    const item = await db.items.get(id);
    if (!item) return null;
    await db.transaction("rw", db.items, async () => {
      const children = await db.items.where("parentId").equals(id).toArray();
      for (const child of children) {
        await db.items.delete(child.id);
      }
      await db.items.delete(id);
    });
    void afterDataMutation();
    return item;
  };

  const restoreItem = async (item: Item) => {
    await db.items.put(item);
    void afterDataMutation();
  };

  const markDone = async (item: Item) => {
    const completedAt = new Date().toISOString();
    const updated = completeItem(item, completedAt);
    await db.transaction("rw", [db.items, db.completions], async () => {
      await db.completions.add(createCompletionLog(item, completedAt));
      await db.items.put(updated);
    });
    void afterDataMutation();
  };

  const snooze = async (item: Item, until: Date) => {
    const updated = snoozeItem(item, until);
    await db.items.put(updated);
    void afterDataMutation();
  };

  const unsnooze = async (item: Item) => {
    const updated = wakeSnoozedItem(item);
    await db.items.put(updated);
    void afterDataMutation();
  };

  const reopen = async (item: Item) => {
    const updated = reopenItem(item);
    await db.items.put(updated);
    void afterDataMutation();
  };

  return {
    items,
    itemsLoading,
    addItem,
    updateItem,
    deleteItem,
    deleteItemCascade,
    restoreItem,
    markDone,
    snooze,
    unsnooze,
    reopen,
  };
}

export function useCompletions() {
  const query = useLiveQuery(
    () => db.completions.orderBy("completedAt").reverse().toArray(),
    [],
  );
  return {
    completions: query ?? [],
    completionsLoading: query === undefined,
  };
}
