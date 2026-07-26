import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import type { CompletionLog, Item } from "../types";

export function createCompletionLog(
  item: Item,
  completedAt: string,
): CompletionLog {
  return {
    id: uuidv4(),
    itemId: item.id,
    itemTitle: item.title,
    itemType: item.type,
    categoryId: item.categoryId,
    completedAt,
    notes: item.notes,
  };
}

export async function logCompletion(item: Item, completedAt: string) {
  await db.completions.add(createCompletionLog(item, completedAt));
}
