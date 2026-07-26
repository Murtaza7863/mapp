import type { Category, Item, ItemInput } from "../../types";

import { nextChildSortOrder } from "../projects";
import type { ProposedFeatureAction, ProposedItem } from "./types";

type AddItemFn = (
  input: Partial<ItemInput> & { title: string },
) => Promise<Item>;

type AddCategoryFn = (data: {
  name: string;
  color: string;
  icon: string;
}) => Promise<void> | void;

const AREA_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];
const AREA_ICONS = ["briefcase", "home", "folder", "star", "map"];

export interface ApplyProposalsResult {
  items: Item[];
  foldersCreated: number;
  areasCreated: number;
}

function pickAreaStyle(index: number): { color: string; icon: string } {
  return {
    color: AREA_COLORS[index % AREA_COLORS.length]!,
    icon: AREA_ICONS[index % AREA_ICONS.length]!,
  };
}

async function ensureFolder(
  existingItems: Item[],
  createdFolders: Map<string, Item>,
  addItem: AddItemFn,
  categoryId: string,
  folderName: string,
): Promise<Item> {
  const key = `${categoryId}|${folderName.toLowerCase()}`;
  const cached = createdFolders.get(key);
  if (cached) return cached;

  const found = existingItems.find(
    (i) =>
      i.type === "project" &&
      i.categoryId === categoryId &&
      i.title.toLowerCase() === folderName.toLowerCase(),
  );
  if (found) {
    createdFolders.set(key, found);
    return found;
  }

  const folder = await addItem({
    title: folderName,
    type: "project",
    categoryId,
  });
  createdFolders.set(key, folder);
  existingItems.push(folder);
  return folder;
}

async function applyFeatureActions(
  actions: ProposedFeatureAction[],
  categories: Category[],
  existingItems: Item[],
  createdFolders: Map<string, Item>,
  addItem: AddItemFn,
  addCategory?: AddCategoryFn,
): Promise<{ foldersCreated: number; areasCreated: number }> {
  let foldersCreated = 0;
  let areasCreated = 0;
  let areaIndex = categories.length;

  for (const action of actions) {
    if (!action.selected || !action.title.trim()) continue;

    if (action.kind === "create_folder") {
      const categoryId =
        action.categoryId ??
        categories.find(
          (c) =>
            action.categoryHint &&
            c.name
              .toLowerCase()
              .startsWith(action.categoryHint.toLowerCase()),
        )?.id ??
        categories[0]?.id ??
        "";

      const before = createdFolders.size;
      await ensureFolder(
        existingItems,
        createdFolders,
        addItem,
        categoryId,
        action.title.trim(),
      );
      if (createdFolders.size > before) foldersCreated += 1;
      continue;
    }

    if (action.kind === "create_area") {
      if (!addCategory) {
        throw new Error("Creating areas is not available right now.");
      }
      const existing = categories.find(
        (c) => c.name.toLowerCase() === action.title.trim().toLowerCase(),
      );
      if (existing) continue;
      const style = pickAreaStyle(areaIndex++);
      await addCategory({
        name: action.title.trim(),
        color: style.color,
        icon: style.icon,
      });
      areasCreated += 1;
    }
  }

  return { foldersCreated, areasCreated };
}

export async function applyProposals(
  proposals: ProposedItem[],
  categories: Category[],
  addItem: AddItemFn,
  options: {
    actions?: ProposedFeatureAction[];
    addCategory?: AddCategoryFn;
    existingItems?: Item[];
  } = {},
): Promise<ApplyProposalsResult> {
  const created: Item[] = [];
  const existingItems = [...(options.existingItems ?? [])];
  const createdFolders = new Map<string, Item>();

  const featureStats = await applyFeatureActions(
    options.actions ?? [],
    categories,
    existingItems,
    createdFolders,
    addItem,
    options.addCategory,
  );

  for (const proposal of proposals) {
    if (!proposal.selected || !proposal.title.trim()) continue;

    const categoryId =
      proposal.categoryId ??
      categories.find(
        (c) =>
          proposal.categoryHint &&
          c.name.toLowerCase().startsWith(proposal.categoryHint.toLowerCase()),
      )?.id ??
      categories[0]?.id ??
      "";

    let parentId: string | undefined;
    if (proposal.parentFolderName?.trim()) {
      const folder = await ensureFolder(
        existingItems,
        createdFolders,
        addItem,
        categoryId,
        proposal.parentFolderName.trim(),
      );
      parentId = folder.id;
    }

    const item = await addItem({
      title: proposal.title.trim(),
      type: proposal.type,
      categoryId,
      parentId,
      childGroup: proposal.childGroup,
      sortOrder:
        parentId !== undefined
          ? nextChildSortOrder(existingItems, parentId)
          : undefined,
      dueAt: proposal.dueAt,
      priority: proposal.priority,
      notes: proposal.notes,
      contactName: proposal.contactName,
      pipelineStage:
        proposal.pipelineStage ??
        (proposal.type === "follow-up" ? "outreach" : undefined),
      ...(proposal.type === "follow-up"
        ? { lastContactAt: new Date().toISOString() }
        : {}),
    });

    existingItems.push(item);
    created.push(item);
  }

  return {
    items: created,
    foldersCreated: featureStats.foldersCreated,
    areasCreated: featureStats.areasCreated,
  };
}
