import type { AppSettings, Category, Item, ItemInput } from "../../types";
import { applyThreadActionToItems } from "../batch-threads";
import { isOverdue } from "../dates";
import { nextChildSortOrder } from "../projects";
import { applyThreadStage, findQuickAction } from "../thread-actions";
import { computeWrapUpSummary, tomorrowMorning } from "../wrapup";

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

type MarkDoneFn = (item: Item) => Promise<unknown>;
type SnoozeFn = (item: Item, until: Date) => Promise<unknown>;
type UnsnoozeFn = (item: Item) => Promise<unknown>;
type DeleteItemFn = (id: string) => Promise<unknown>;
type DeleteItemCascadeFn = (id: string) => Promise<unknown>;
type UpdateItemFn = (id: string, changes: Partial<Item>) => Promise<unknown>;
type UpdateItemsFn = (
  updates: Array<{ id: string; changes: Partial<Item> }>,
) => Promise<unknown>;
type ReopenFn = (item: Item) => Promise<unknown>;
type NavigateFn = (to: string) => void;
type DeleteCategoryFn = (id: string) => Promise<unknown>;
type UpdateSettingsFn = (
  partial: Partial<Omit<AppSettings, "id">>,
) => Promise<unknown>;
type ExportDataFn = (categoryId?: string) => Promise<unknown>;
type RestoreBackupFn = () => Promise<unknown>;
type SyncScheduleFn = () => Promise<unknown>;

export interface PlotApplyContext {
  categories: Category[];
  items: Item[];
  addItem: AddItemFn;
  addCategory: AddCategoryFn;
  updateCategory: UpdateCategoryFn;
  deleteCategory?: DeleteCategoryFn;
  markDone?: MarkDoneFn;
  snooze?: SnoozeFn;
  unsnooze?: UnsnoozeFn;
  deleteItem?: DeleteItemFn;
  deleteItemCascade?: DeleteItemCascadeFn;
  updateItem?: UpdateItemFn;
  updateItems?: UpdateItemsFn;
  reopen?: ReopenFn;
  navigate?: NavigateFn;
  openSheet?: (sheet: "wrapup" | "triage") => void;
  updateSettings?: UpdateSettingsFn;
  exportData?: ExportDataFn;
  restoreBackup?: RestoreBackupFn;
  syncSchedule?: SyncScheduleFn;
  completions?: { completedAt: string }[];
}

export interface ApplyProposalsOptions {
  actions?: ProposedFeatureAction[];
}

export interface ApplyProposalsResult {
  items: Item[];
  foldersCreated: number;
  areasCreated: number;
  completed: number;
  snoozed: number;
  unsnoozed: number;
  deleted: number;
  updated: number;
  navigated: number;
  reopened: number;
  parked: number;
  settingsUpdated: number;
  exported: number;
  bumped: number;
  duplicated: number;
  restored: number;
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

function findTarget(
  ctx: PlotApplyContext,
  action: ProposedFeatureAction,
): Item | undefined {
  if (action.resolvedItemId) {
    return ctx.items.find((i) => i.id === action.resolvedItemId);
  }
  return undefined;
}

async function applyFeatureActions(
  actions: ProposedFeatureAction[],
  ctx: PlotApplyContext,
): Promise<{
  foldersCreated: number;
  areasCreated: number;
  completed: number;
  snoozed: number;
  unsnoozed: number;
  deleted: number;
  updated: number;
  navigated: number;
  reopened: number;
  parked: number;
  settingsUpdated: number;
  exported: number;
  bumped: number;
  duplicated: number;
  restored: number;
}> {
  let foldersCreated = 0;
  let areasCreated = 0;
  let completed = 0;
  let snoozed = 0;
  let unsnoozed = 0;
  let deleted = 0;
  let updated = 0;
  let navigated = 0;
  let reopened = 0;
  let parked = 0;
  let settingsUpdated = 0;
  let exported = 0;
  let bumped = 0;
  let duplicated = 0;
  let restored = 0;

  for (const action of actions) {
    if (!action.selected) continue;

    if (action.kind === "create_folder") {
      if (!action.title.trim()) continue;
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
      if (!action.title.trim()) continue;
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
      continue;
    }

    if (action.kind === "navigate") {
      if (action.categoryHint && ctx.navigate && !action.targetQuery) {
        const id = resolveCategoryId(action.categoryHint, ctx.categories);
        if (id) {
          ctx.navigate(`/?area=${id}`);
          navigated += 1;
          continue;
        }
      }
      if (action.openSheet && ctx.openSheet) ctx.openSheet(action.openSheet);
      if (action.navigateTo && ctx.navigate) {
        ctx.navigate(action.navigateTo);
        navigated += 1;
      }
      continue;
    }

    if (action.kind === "park_open") {
      if (!ctx.snooze) continue;
      const until = action.dueAt ? new Date(action.dueAt) : tomorrowMorning();
      const parkable = computeWrapUpSummary(
        ctx.items,
        (ctx.completions as never) ?? [],
      ).parkable;
      for (const item of parkable) {
        await ctx.snooze(item, until);
        parked += 1;
      }
      continue;
    }

    if (action.kind === "bump_nudges") {
      const actionDef = findQuickAction("Bump sent");
      if (!actionDef || !ctx.updateItems) continue;
      const chase = ctx.items.filter(
        (i) => i.type === "follow-up" && i.status === "pending",
      );
      const updates = applyThreadActionToItems(chase, actionDef);
      if (updates.length === 0) continue;
      await ctx.updateItems(updates);
      bumped += updates.length;
      continue;
    }

    if (action.kind === "complete_overdue") {
      if (!ctx.markDone) continue;
      const overdue = ctx.items.filter(
        (i) =>
          i.status === "pending" &&
          i.type !== "routine" &&
          i.type !== "follow-up" &&
          isOverdue(i),
      );
      for (const item of overdue) {
        await ctx.markDone(item);
        completed += 1;
      }
      continue;
    }

    if (action.kind === "export_data") {
      if (!ctx.exportData) continue;
      const catId =
        action.categoryId ??
        resolveCategoryId(action.categoryHint, ctx.categories);
      await ctx.exportData(catId);
      exported += 1;
      continue;
    }

    if (action.kind === "restore_backup") {
      if (!ctx.restoreBackup) continue;
      await ctx.restoreBackup();
      restored += 1;
      continue;
    }

    if (action.kind === "update_settings") {
      if (action.summary === "Sync notification schedule" && ctx.syncSchedule) {
        await ctx.syncSchedule();
        settingsUpdated += 1;
        continue;
      }
      if (!ctx.updateSettings || !action.settingsPatch) continue;
      const patch = { ...action.settingsPatch };
      if (!patch.defaultCategoryId && patch.defaultCategoryHint) {
        patch.defaultCategoryId = resolveCategoryId(
          patch.defaultCategoryHint,
          ctx.categories,
        );
      }
      const { defaultCategoryHint: _hint, ...rest } = patch;
      await ctx.updateSettings(rest);
      if (ctx.syncSchedule && rest.digestEnabled !== undefined) {
        await ctx.syncSchedule();
      }
      settingsUpdated += 1;
      continue;
    }

    if (action.kind === "update_area") {
      if (!action.areaPatch) continue;
      const catId =
        action.categoryId ??
        resolveCategoryId(action.categoryHint ?? action.title, ctx.categories);
      if (!catId) continue;
      await ctx.updateCategory(catId, action.areaPatch);
      const idx = ctx.categories.findIndex((c) => c.id === catId);
      if (idx >= 0) {
        ctx.categories[idx] = { ...ctx.categories[idx], ...action.areaPatch };
      }
      updated += 1;
      continue;
    }

    if (action.kind === "rename_area") {
      const fromHint = action.categoryHint ?? action.title;
      const catId = resolveCategoryId(fromHint, ctx.categories);
      if (!catId || !action.title.trim()) continue;
      await ctx.updateCategory(catId, { name: action.title.trim() });
      const idx = ctx.categories.findIndex((c) => c.id === catId);
      if (idx >= 0) {
        ctx.categories[idx] = {
          ...ctx.categories[idx],
          name: action.title.trim(),
        };
      }
      updated += 1;
      continue;
    }

    if (action.kind === "delete_area") {
      if (!ctx.deleteCategory) continue;
      const catId =
        action.categoryId ??
        resolveCategoryId(action.categoryHint ?? action.title, ctx.categories);
      if (!catId) continue;
      await ctx.deleteCategory(catId);
      ctx.categories = ctx.categories.filter((c) => c.id !== catId);
      deleted += 1;
      continue;
    }

    if (action.kind === "delete_folder") {
      const folder =
        findTarget(ctx, action) ??
        ctx.items.find(
          (i) =>
            i.type === "project" &&
            !i.parentId &&
            i.title.toLowerCase() === action.title.trim().toLowerCase(),
        );
      if (!folder) continue;
      if (ctx.deleteItemCascade) await ctx.deleteItemCascade(folder.id);
      else if (ctx.deleteItem) await ctx.deleteItem(folder.id);
      else continue;
      deleted += 1;
      continue;
    }

    if (action.kind === "rename_folder") {
      if (!ctx.updateItem) continue;
      const folder = findTarget(ctx, action);
      if (!folder || !action.patch?.title) continue;
      await ctx.updateItem(folder.id, { title: action.patch.title });
      updated += 1;
      continue;
    }

    if (action.kind === "move_folder") {
      if (!ctx.updateItem) continue;
      const folder = findTarget(ctx, action);
      const catId =
        action.patch?.categoryId ??
        action.categoryId ??
        resolveCategoryId(
          action.patch?.categoryHint ?? action.categoryHint,
          ctx.categories,
        );
      if (!folder || !catId) continue;
      await ctx.updateItem(folder.id, { categoryId: catId });
      const children = ctx.items.filter((i) => i.parentId === folder.id);
      for (const child of children) {
        await ctx.updateItem(child.id, { categoryId: catId });
      }
      updated += 1;
      continue;
    }

    const target = findTarget(ctx, action);
    if (!target) continue;

    if (action.kind === "duplicate_item") {
      const copy = await ctx.addItem({
        title: `${target.title} (copy)`,
        type: target.type,
        categoryId: target.categoryId,
        parentId: target.parentId,
        childGroup: target.childGroup,
        dueAt: target.dueAt,
        priority: target.priority,
        notes: target.notes,
        contactName: target.contactName,
        pipelineStage: target.pipelineStage,
        recurrence: target.recurrence,
        reminderOffsetMinutes: target.reminderOffsetMinutes,
        notificationsMuted: target.notificationsMuted,
        goalCount: target.goalCount,
        sortOrder: target.parentId
          ? nextChildSortOrder(ctx.items, target.parentId)
          : undefined,
      });
      ctx.items.push(copy);
      duplicated += 1;
      continue;
    }

    if (action.kind === "complete_item") {
      if (!ctx.markDone) continue;
      await ctx.markDone(target);
      completed += 1;
      continue;
    }

    if (action.kind === "reopen_item") {
      if (!ctx.reopen) continue;
      await ctx.reopen(target);
      reopened += 1;
      continue;
    }

    if (action.kind === "snooze_item") {
      if (!ctx.snooze || !action.dueAt) continue;
      await ctx.snooze(target, new Date(action.dueAt));
      snoozed += 1;
      continue;
    }

    if (action.kind === "unsnooze_item") {
      if (!ctx.unsnooze) continue;
      await ctx.unsnooze(target);
      unsnoozed += 1;
      continue;
    }

    if (action.kind === "delete_item") {
      if (!ctx.deleteItem) continue;
      await ctx.deleteItem(target.id);
      deleted += 1;
      continue;
    }

    if (action.kind === "update_item") {
      if (!ctx.updateItem) continue;
      const changes: Partial<Item> = {};
      if (action.patch?.title) changes.title = action.patch.title;
      if (action.patch?.priority !== undefined) {
        changes.priority = action.patch.priority;
      }
      if (action.patch?.categoryId)
        changes.categoryId = action.patch.categoryId;
      else if (action.patch?.categoryHint) {
        const id = resolveCategoryId(action.patch.categoryHint, ctx.categories);
        if (id) changes.categoryId = id;
      }
      if (action.patch?.type) {
        changes.type = action.patch.type;
        if (action.patch.type === "follow-up" && !target.pipelineStage) {
          changes.pipelineStage = "outreach";
          changes.lastContactAt = new Date().toISOString();
        }
      }
      if (action.patch?.recurrence !== undefined) {
        changes.recurrence = action.patch.recurrence ?? undefined;
        if (action.patch.recurrence && !changes.type) {
          changes.type = "routine";
        }
      }
      if (action.patch?.notes !== undefined) {
        changes.notes = action.patch.notes || undefined;
      }
      if (action.patch?.contactName !== undefined) {
        changes.contactName = action.patch.contactName || undefined;
      }
      if (action.patch?.nextAction !== undefined) {
        changes.nextAction = action.patch.nextAction || undefined;
      }
      if (action.patch?.checkBackAt !== undefined) {
        changes.checkBackAt = action.patch.checkBackAt ?? undefined;
      }
      if (action.patch?.linkedEventAt !== undefined) {
        changes.linkedEventAt = action.patch.linkedEventAt ?? undefined;
      }
      if (action.patch?.notificationsMuted !== undefined) {
        changes.notificationsMuted = action.patch.notificationsMuted;
      }
      if (action.patch?.reminderOffsetMinutes !== undefined) {
        changes.reminderOffsetMinutes =
          action.patch.reminderOffsetMinutes ?? undefined;
      }
      if (action.patch?.childGroup !== undefined) {
        changes.childGroup = action.patch.childGroup ?? undefined;
      }
      if (action.patch?.lastContactAt !== undefined) {
        changes.lastContactAt = action.patch.lastContactAt ?? undefined;
      }
      if (action.patch?.goalCount !== undefined) {
        changes.goalCount = action.patch.goalCount ?? undefined;
      }
      if (action.patch?.parentFolderName !== undefined) {
        if (action.patch.parentFolderName === null) {
          changes.parentId = undefined;
        } else {
          const folderName = action.patch.parentFolderName.trim();
          const folder =
            ctx.items.find(
              (i) =>
                i.type === "project" &&
                !i.parentId &&
                i.title.toLowerCase() === folderName.toLowerCase(),
            ) ?? (await ensureFolder(ctx, target.categoryId, folderName));
          changes.parentId = folder.id;
          if (!changes.categoryId) changes.categoryId = folder.categoryId;
        }
      }
      if (action.patch?.dueAt !== undefined) {
        changes.dueAt = action.patch.dueAt ?? undefined;
      } else if (action.dueAt) {
        changes.dueAt = action.dueAt;
      }
      if (Object.keys(changes).length === 0) continue;
      await ctx.updateItem(target.id, changes);
      updated += 1;
      continue;
    }

    if (action.kind === "set_pipeline") {
      if (!ctx.updateItem || !action.pipelineStage) continue;
      const quick =
        action.pipelineStage === "waiting"
          ? findQuickAction("Bump sent")
          : action.pipelineStage === "scheduling"
            ? findQuickAction("They replied")
            : action.pipelineStage === "my_turn"
              ? findQuickAction("Your turn")
              : action.pipelineStage === "deferred"
                ? findQuickAction("Revisit later")
                : undefined;
      const stagePatch = quick
        ? applyThreadStage(target, quick)
        : {
            pipelineStage: action.pipelineStage,
            lastContactAt: new Date().toISOString(),
          };
      await ctx.updateItem(target.id, stagePatch);
      updated += 1;
    }
  }

  return {
    foldersCreated,
    areasCreated,
    completed,
    snoozed,
    unsnoozed,
    deleted,
    updated,
    navigated,
    reopened,
    parked,
    settingsUpdated,
    exported,
    bumped,
    duplicated,
    restored,
  };
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
    completed: featureStats.completed,
    snoozed: featureStats.snoozed,
    unsnoozed: featureStats.unsnoozed,
    deleted: featureStats.deleted,
    updated: featureStats.updated,
    navigated: featureStats.navigated,
    reopened: featureStats.reopened,
    parked: featureStats.parked,
    settingsUpdated: featureStats.settingsUpdated,
    exported: featureStats.exported,
    bumped: featureStats.bumped,
    duplicated: featureStats.duplicated,
    restored: featureStats.restored,
  };
}

/** @deprecated Use PlotApplyContext — kept for type re-export */
export type { PlotApplyContext as ApplyContext };
