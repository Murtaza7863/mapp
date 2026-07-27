import type { Category } from "../../types";

import { resolveCategoryId } from "./validate";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find a user area mentioned in natural language (e.g. "for ATLAS", "#atlas"). */
export function findCategoryInText(
  text: string,
  categories: Category[],
): Category | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const forTail = trimmed.match(
    /\b(?:for|in|on|under)\s+([#@]?[\w][\w\s-]{0,40})\s*$/i,
  );
  if (forTail) {
    const hint = forTail[1].replace(/^[#@]/, "").trim();
    const id = resolveCategoryId(hint, categories);
    if (id) return categories.find((c) => c.id === id);
  }

  const sorted = [...categories].sort((a, b) => b.name.length - a.name.length);
  for (const cat of sorted) {
    const name = cat.name.trim();
    if (name.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    if (re.test(trimmed)) return cat;
  }

  return undefined;
}

export function stripCategoryMentions(
  text: string,
  categoryName: string,
): string {
  const esc = escapeRegExp(categoryName);
  return text
    .replace(new RegExp(`\\s+(?:for|in|on|under)\\s+${esc}\\s*$`, "i"), "")
    .replace(new RegExp(`\\s+#${esc}(?=\\s|$)`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCategoryName(token: string, categories: Category[]): boolean {
  return Boolean(resolveCategoryId(token.trim(), categories));
}
