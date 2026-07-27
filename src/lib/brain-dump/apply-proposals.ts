import type { Category, Item, ItemInput } from "../../types";
import { nextChildSortOrder } from "../projects";

import type { PlotStructure } from "./structure-parser";
import type { ProposedFeatureAction, ProposedItem } from "./types";
import { resolveCategoryId } from "./validate";

type AddItemFn = (
  input: Partial<ItemInput> & { title: string },
) => Promise<Item>;

type AddCategoryFn = (
  data: Omit<Category, "id" | "sortOrder">,
) => Promise<Category>;

type UpdateCategoryFn = (
  id: string,
  changes: Partial<Category>,
) => Promise<void>;

export interface PlotApplyContext {
  categories: Category[];
  items: Item[];
  addItem: AddItemFn;
  addCategory: AddCategoryFn;
  updateCategory: UpdateCategoryFn;
}

export interface ApplyProposalsOptions {
  actions?: ProposedFeatureAction[];
}

export interface ApplyProposalsResult {
  items: Item[];
  foldersCreated: number;
  areasCreated: number;
}

const DEFAULT_COLORS = [
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#6366f1",
];

const AREA_ICONS = ["briefcase", "home", "folder", "star", "map"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mergeSubgroups(
  existing: string[] | undefined,
  incoming: string[] | undefined,
): string[] | undefined {
  if (!incoming?.length) return existing;
  const merged = [...(existing ?? [])];
  for (const sg of incoming) {
    if (!merged.some((m) => m.toLowerCase() === sg.toLowerCase())) {
      merged.push(capitalize(sg));
    }
  }
  return merged;
}

async function ensureArea(
  ctx: PlotApplyContext,
  structure: PlotStructure | undefined,
  hint?: string,
): Promise<Category> {
  const name = structure?.areaName ?? hint;
  if (!name) {
    const fallback = ctx.categories[0];
    if (!fallback) throw new Error("No areas configured.");
    return fallback;
  }

  const existing = ctx.categories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    const merged = mergeSubgroups(
      existing.subgroups,
      structure?.ensureSubgroups,
    );
    if (merged && merged.length !== (existing.subgroups?.length ?? 0)) {
      await ctx.updateCategory(existing.id, { subgroups: merged });
      const updated = { ...existing, subgroups: merged };
      const idx = ctx.categories.findIndex((c) => c.id === existing.id);
      if (idx >= 0) ctx.categories[idx] = updated;
      return updated;
    }
    return existing;
  }

  if (!structure?.createArea && !structure?.areaName) {
    const fromHint = resolveCategoryId(name, ctx.categories);
    const cat = ctx.categories.find((c) => c.id === fromHint);
    if (cat) return cat;
  }

  const color =
    DEFAULT_COLORS[ctx.categories.length % DEFAULT_COLORS.length] ?? "#f59e0b";
  const created = await ctx.addCategory({
    name: capitalize(name),
    color,
    icon: AREA_ICONS[ctx.categories.length % AREA_ICONS.length] ?? "folder",
    subgroups: structure?.ensureSubgroups?.map(capitalize),
  });
  ctx.categories.push(created);
  return created;
}

async function ensureFolder(
  ctx: PlotApplyContext,
  categoryId: string,
  folderName: string,
): Promise<Item> {
  const existing = ctx.items.find(
    (i) =>
      i.type === "project" &&
      !i.parentId &&
      i.categoryId === categoryId &&
      i.title.toLowerCase() === folderName.toLowerCase(),
  );
  if (existing) return existing;

  const folder = await ctx.addItem({
    title: folderName,
    type: "project",
    categoryId,
  });
  ctx.items.push(folder);
  return folder;
}

async function applyFeatureActions(
  actions: ProposedFeatureAction[],
  ctx: PlotApplyContext,
): Promise<{ foldersCreated: number; areasCreated: number }> {
  let foldersCreated = 0;
  let areasCreated = 0;

  for (const action of actions) {
    if (!action.selected || !action.title.trim()) continue;

    if (action.kind === "create_folder") {
      const categoryId =
        action.categoryId ??
        ctx.categories.find(
          (c) =>
            action.categoryHint &&
            c.name.toLowerCase().startsWith(action.categoryHint.toLowerCase()),
        )?.id ??
        ctx.categories[0]?.id ??
        "";

      const before = ctx.items.length;
      await ensureFolder(ctx, categoryId, action.title.trim());
      if (ctx.items.length > before) foldersCreated += 1;
      continue;
    }

    if (action.kind === "create_area") {
      const existing = ctx.categories.find(
        (c) => c.name.toLowerCase() === action.title.trim().toLowerCase(),
      );
      if (existing) continue;

      const before = ctx.categories.length;
      await ensureArea(
        ctx,
        { areaName: action.title.trim(), createArea: true, taskText: "" },
        action.categoryHint,
      );
      if (ctx.categories.length > before) areasCreated += 1;
    }
  }

  return { foldersCreated, areasCreated };
}

export async function applyProposals(
  proposals: ProposedItem[],
  ctx: PlotApplyContext,
  options: ApplyProposalsOptions = {},
): Promise<ApplyProposalsResult> {
  const created: Item[] = [];

  const featureStats = await applyFeatureActions(options.actions ?? [], ctx);

  for (const proposal of proposals) {
    if (!proposal.selected || !proposal.title.trim()) continue;

    const area = await ensureArea(
      ctx,
      proposal.structure,
      proposal.categoryHint,
    );

    let parentId: string | undefined;
    let childGroup = proposal.structure?.childGroup ?? proposal.childGroup;

    const folderName =
      proposal.structure?.folderName ?? proposal.parentFolderName?.trim();
    if (folderName) {
      const folder = await ensureFolder(ctx, area.id, folderName);
      parentId = folder.id;

      if (proposal.structure?.childGroup) {
        const merged = mergeSubgroups(area.subgroups, [
          proposal.structure.childGroup,
        ]);
        if (merged && merged.length !== (area.subgroups?.length ?? 0)) {
          await ctx.updateCategory(area.id, { subgroups: merged });
          area.subgroups = merged;
          const idx = ctx.categories.findIndex((c) => c.id === area.id);
          if (idx >= 0) ctx.categories[idx] = { ...area, subgroups: merged };
        }
      }
    }

    const item = await ctx.addItem({
      title: proposal.title.trim(),
      type: proposal.type,
      categoryId: area.id,
      parentId,
      childGroup,
      dueAt: proposal.dueAt,
      priority: proposal.priority,
      notes: proposal.notes,
      contactName: proposal.contactName,
      sortOrder: parentId ? nextChildSortOrder(ctx.items, parentId) : undefined,
      pipelineStage:
        proposal.pipelineStage ??
        (proposal.type === "follow-up" ? "outreach" : undefined),
      ...(proposal.type === "follow-up"
        ? { lastContactAt: new Date().toISOString() }
        : {}),
    });

    ctx.items.push(item);
    created.push(item);
  }

  return {
    items: created,
    foldersCreated: featureStats.foldersCreated,
    areasCreated: featureStats.areasCreated,
  };
}

/** @deprecated Use PlotApplyContext — kept for type re-export */
export type { PlotApplyContext as ApplyContext };
