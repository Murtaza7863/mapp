import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Item } from "../types";

export interface ProjectProgress {
  done: number;
  total: number;
  goal?: number;
  /** 0–100 based on goal if set, otherwise children done / total */
  percent: number;
  label: string;
}

export function isContainer(item: Item): boolean {
  return item.type === "project";
}

export function isChildItem(item: Item): boolean {
  return Boolean(item.parentId);
}

export function getDoneChildren(items: Item[], parentId: string): Item[] {
  return sortItems(
    items.filter((i) => i.parentId === parentId && i.status === "done"),
  );
}

export function getChildren(items: Item[], parentId: string): Item[] {
  return sortItems(
    items.filter((i) => i.parentId === parentId && i.status !== "done"),
  );
}

export function getAllChildren(items: Item[], parentId: string): Item[] {
  return sortItems(items.filter((i) => i.parentId === parentId));
}

export function getRootProjects(
  items: Item[],
  options: { categoryId?: string; excludeCategoryId?: string } = {},
): Item[] {
  const { categoryId, excludeCategoryId } = options;
  return sortItems(
    items.filter((i) => {
      if (!isContainer(i) || i.parentId) return false;
      if (i.status === "done") return false;
      if (categoryId && i.categoryId !== categoryId) return false;
      if (excludeCategoryId && i.categoryId === excludeCategoryId) return false;
      return true;
    }),
  );
}

export function computeProgress(parent: Item, items: Item[]): ProjectProgress {
  const children = getAllChildren(items, parent.id);
  const done = children.filter((c) => c.status === "done").length;
  const total = children.length;
  const goal =
    parent.goalCount && parent.goalCount > 0 ? parent.goalCount : undefined;
  const target = goal ?? Math.max(total, 1);
  const percent = Math.min(100, Math.round((done / target) * 100));

  const label = goal
    ? `${done} / ${goal} goal`
    : total > 0
      ? `${done} / ${total} done`
      : "No tasks yet";

  return { done, total, goal, percent, label };
}

export function nextExamCountdown(
  parent: Item,
  items: Item[],
): { days: number; title: string } | null {
  const exams = getAllChildren(items, parent.id).filter(
    (c) =>
      c.status !== "done" &&
      c.dueAt &&
      (c.childGroup?.toLowerCase() === "exam" || c.schoolKind === "exam"),
  );
  if (exams.length === 0) return null;
  const soonest = [...exams].sort(
    (a, b) => parseISO(a.dueAt!).getTime() - parseISO(b.dueAt!).getTime(),
  )[0];
  const days = differenceInCalendarDays(parseISO(soonest.dueAt!), new Date());
  return { days, title: soonest.title };
}

export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (a.dueAt && b.dueAt) {
      return parseISO(a.dueAt).getTime() - parseISO(b.dueAt).getTime();
    }
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function nextChildSortOrder(items: Item[], parentId: string): number {
  const siblings = items.filter((i) => i.parentId === parentId);
  if (siblings.length === 0) return 0;
  const max = siblings.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), -1);
  return max + 1;
}

/** Leaf tasks only — excludes project containers and nested children from flat lists */
export function filterTopLevelForArea(items: Item[]): Item[] {
  return items.filter((i) => !i.parentId && !isContainer(i));
}
