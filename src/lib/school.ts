import type { Category, Item } from "../types";
import { getRootProjects } from "./projects";

export const SCHOOL_CATEGORY_NAME = "School";

export function findSchoolCategory(
  categories: Category[],
): Category | undefined {
  return categories.find(
    (c) => c.name.toLowerCase() === SCHOOL_CATEGORY_NAME.toLowerCase(),
  );
}

/** @deprecated use getContainersForCategory */
export function getSchoolModules(
  items: Item[],
  schoolCategoryId: string,
): Item[] {
  return getRootProjects(items, { categoryId: schoolCategoryId });
}

export function parseSchoolQuickAdd(title: string): {
  moduleName: string;
  childGroup?: string;
  taskTitle: string;
} | null {
  const match = title.match(/^(.+?)\s+(homework|exam|hw)\s*:\s*(.+)$/i);
  if (!match) return null;
  const [, mod, kindRaw, task] = match;
  const childGroup =
    kindRaw.toLowerCase() === "exam" || kindRaw.toLowerCase() === "exams"
      ? "Exam"
      : "Homework";
  return {
    moduleName: mod.trim(),
    childGroup,
    taskTitle: task.trim(),
  };
}
