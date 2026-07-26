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
  const trimmed = line.trim();
  // “put X in smubia folder” is folder placement, not an area suffix.
  if (/\bfolder\s*$/i.test(trimmed) || /^put\s+.+\s+in\s+.+\s+folder\s*$/i.test(trimmed)) {
    return { text: trimmed };
  }

  const match = trimmed.match(
    /\s+in\s+(?:the\s+)?([#@]?[\w][\w-]+)(?:\s+(?:workspace|area))?\s*$/i,
  );
  if (!match) return { text: trimmed };

  const hint = match[1].replace(/^#/, "").trim();
  const categoryId = resolveCategoryId(hint, categories);
  if (!categoryId) return { text: trimmed };

  return {
    text: trimmed.slice(0, match.index).trim(),
    categoryId,
    categoryHint: hint,
  };
}
