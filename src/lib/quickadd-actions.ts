import type { Category, Item } from "../types";

import { db } from "../db";
import { parseContainerQuickAdd } from "./containers";
import { nextChildSortOrder } from "./projects";
import type { ParsedQuickAdd } from "./quickadd";

export interface QuickAddContext {
  categories: Category[];
  items: Item[];
  addItem: (
    input: Partial<import("../types").ItemInput> & { title: string },
  ) => Promise<Item>;
}

let folderLock: Promise<unknown> = Promise.resolve();

async function ensureFolder(
  ctx: QuickAddContext,
  category: Category,
  folderName: string,
): Promise<Item> {
  const execute = async () => {
    const inCategory = await db.items
      .where("categoryId")
      .equals(category.id)
      .toArray();
    const existing = inCategory.find(
      (i) =>
        i.type === "project" &&
        i.title.toLowerCase() === folderName.toLowerCase(),
    );
    if (existing) return existing;
    return ctx.addItem({
      title: folderName,
      type: "project",
      categoryId: category.id,
    });
  };

  const result = folderLock.then(execute);
  folderLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function applyQuickAdd(
  parsed: ParsedQuickAdd,
  ctx: QuickAddContext,
): Promise<Item> {
  const categoryId = parsed.categoryId ?? ctx.categories[0]?.id ?? "";
  const category =
    ctx.categories.find((c) => c.id === categoryId) ?? ctx.categories[0];

  if (category) {
    const container = parseContainerQuickAdd(
      parsed.title,
      category.subgroups ?? [],
    );
    if (container) {
      const folder = await ensureFolder(ctx, category, container.folderName);
      return ctx.addItem({
        title: container.taskTitle,
        type: "deadline",
        categoryId: category.id,
        parentId: folder.id,
        childGroup: container.childGroup,
        sortOrder: nextChildSortOrder([...ctx.items, folder], folder.id),
        ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
        priority: parsed.priority,
      });
    }

    const simpleFolder = parsed.title.match(/^(.+?)\s*:\s*(.+)$/);
    if (simpleFolder) {
      const [, folderName, taskTitle] = simpleFolder;
      const folder = await ensureFolder(ctx, category, folderName.trim());
      return ctx.addItem({
        title: taskTitle.trim(),
        type: "deadline",
        categoryId: category.id,
        parentId: folder.id,
        sortOrder: nextChildSortOrder([...ctx.items, folder], folder.id),
        ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
        priority: parsed.priority,
      });
    }
  }

  const type = parsed.type ?? "deadline";
  return ctx.addItem({
    title: parsed.title,
    categoryId,
    type,
    ...(parsed.dueAt ? { dueAt: parsed.dueAt } : {}),
    priority: parsed.priority,
    ...(type === "follow-up"
      ? {
          pipelineStage: "outreach" as const,
          lastContactAt: new Date().toISOString(),
        }
      : {}),
  });
}
