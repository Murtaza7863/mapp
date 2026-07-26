const LAST_CATEGORY_KEY = "mapp:lastCategoryId";

export function getLastCategoryId(): string | null {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY);
  } catch {
    return null;
  }
}

export function setLastCategoryId(id: string) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, id);
  } catch {
    /* ignore */
  }
}
