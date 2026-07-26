import type { Category, Item, ItemInput } from "../../types";

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

async function applyFeatureActions(
  actions: ProposedFeatureAction[],
  categories: Category[],
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

      await addItem({
        title: action.title.trim(),
        type: "project",
        categoryId,
      });
      foldersCreated += 1;
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
  } = {},
): Promise<ApplyProposalsResult> {
  const created: Item[] = [];

  const featureStats = await applyFeatureActions(
    options.actions ?? [],
    categories,
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

    const item = await addItem({
      title: proposal.title.trim(),
      type: proposal.type,
      categoryId,
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

    created.push(item);
  }

  return {
    items: created,
    foldersCreated: featureStats.foldersCreated,
    areasCreated: featureStats.areasCreated,
  };
}
