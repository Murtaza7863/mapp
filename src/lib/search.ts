import type { Item } from "../types";

export interface SearchFilters {
  query: string;
  type?: Item["type"] | "all";
  status?: Item["status"] | "all";
  categoryId?: string | "all";
}

export function searchItems(items: Item[], filters: SearchFilters): Item[] {
  const q = filters.query.trim().toLowerCase();

  return items
    .filter((item) => {
      if (filters.type && filters.type !== "all" && item.type !== filters.type)
        return false;
      if (
        filters.status &&
        filters.status !== "all" &&
        item.status !== filters.status
      )
        return false;
      if (
        filters.categoryId &&
        filters.categoryId !== "all" &&
        item.categoryId !== filters.categoryId
      )
        return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        item.contactName?.toLowerCase().includes(q) ||
        item.waitingOn?.toLowerCase().includes(q) ||
        item.nextAction?.toLowerCase().includes(q) ||
        item.childGroup?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      if (a.status !== b.status) {
        if (a.status === "pending") return -1;
        if (b.status === "pending") return 1;
      }
      return aTime - bTime;
    });
}
