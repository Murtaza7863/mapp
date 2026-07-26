import type { Category, Item } from "../types";
import { SCHOOL_KIND_LABELS } from "../types";
import { getRootProjects, sortItems } from "./projects";

export function getChildGroup(item: Item): string | undefined {
  if (item.childGroup) return item.childGroup;
  if (item.schoolKind) return SCHOOL_KIND_LABELS[item.schoolKind];
  return undefined;
}

export function getContainersForCategory(
  items: Item[],
  categoryId: string,
): Item[] {
  return getRootProjects(items, { categoryId });
}

export function groupChildrenBySubgroup(
  children: Item[],
  subgroups: string[],
): Map<string, Item[]> {
  const map = new Map<string, Item[]>();
  for (const sg of subgroups) map.set(sg, []);

  const ungrouped: Item[] = [];

  for (const child of sortItems(children)) {
    const group = getChildGroup(child);
    const match =
      group && subgroups.find((s) => s.toLowerCase() === group.toLowerCase());
    if (match) {
      map.get(match)!.push(child);
    } else if (group) {
      const existing = [...map.keys()].find(
        (k) => k.toLowerCase() === group.toLowerCase(),
      );
      if (existing) {
        map.get(existing)!.push(child);
      } else {
        map.set(group, [child]);
      }
    } else {
      ungrouped.push(child);
    }
  }

  if (ungrouped.length > 0) map.set("__other__", ungrouped);
  return map;
}

export function subgroupSectionLabel(key: string): string {
  if (key === "__other__") return "Other";
  return key;
}

export function categoryHasSubgroups(category?: Category): boolean {
  return Boolean(category?.subgroups && category.subgroups.length > 0);
}

export function matchSubgroup(
  subgroups: string[],
  token: string,
): string | undefined {
  const q = token.trim().toLowerCase();
  return subgroups.find((s) => s.toLowerCase() === q);
}

export function parseContainerQuickAdd(
  title: string,
  subgroups: string[] = [],
): {
  folderName: string;
  childGroup?: string;
  taskTitle: string;
} | null {
  if (subgroups.length === 0) return null;
  const escaped = subgroups.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const re = new RegExp(`^(.+?)\\s+(${escaped.join("|")})\\s*:\\s*(.+)$`, "i");
  const match = title.match(re);
  if (!match) return null;
  const [, folder, groupToken, task] = match;
  const childGroup = matchSubgroup(subgroups, groupToken);
  return {
    folderName: folder.trim(),
    childGroup,
    taskTitle: task.trim(),
  };
}
