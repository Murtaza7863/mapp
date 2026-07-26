import type { Category } from "../../types";

import { resolveCategoryId } from "./validate";

/** Strip trailing “in Work / in Personal / in the X workspace”. */
export function stripAreaSuffix(
  line: string,
  categories: Category[],
): {
  text: string;
  categoryId?: string;
  categoryHint?: string;
} {
  const match = line.match(
    /\s+in\s+(?:the\s+)?([#@]?[\w][\w\s-]*?)(?:\s+(?:workspace|area))?\s*$/i,
  );
  if (!match) return { text: line.trim() };

  const hint = match[1].replace(/^#/, "").trim();
  const categoryId = resolveCategoryId(hint, categories);
  if (!categoryId) return { text: line.trim() };

  return {
    text: line.slice(0, match.index).trim(),
    categoryId,
    categoryHint: hint,
  };
}
