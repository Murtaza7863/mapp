import type { Item } from "../types";

import { applyThreadStage, type ThreadQuickAction } from "./thread-actions";

export function applyThreadActionToItems(
  items: Item[],
  action: ThreadQuickAction,
  now = new Date(),
): Array<{ id: string; changes: Partial<Item> }> {
  return items
    .filter((item) => item.type === "follow-up" && item.status !== "done")
    .map((item) => ({
      id: item.id,
      changes: applyThreadStage(item, action, now),
    }));
}
