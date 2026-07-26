import type { Category } from "../../types";

import { matchFeatureIntent } from "./features";
import { looksLikeTaskSegment } from "./title-cleanup";

/** Split `;` chunks and `feature and task` compounds inside one line. */
export function expandLineSegments(
  line: string,
  categories: Category[],
): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const parts = trimmed.includes(";")
    ? trimmed.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean)
    : [trimmed];

  const out: string[] = [];
  for (const part of parts) {
    const andSplit = trySplitFeatureAndTask(part, categories);
    out.push(...andSplit);
  }
  return out;
}

function trySplitFeatureAndTask(
  part: string,
  categories: Category[],
): string[] {
  const andMatch = part.match(/^(.+?)\s+and\s+(.+)$/i);
  if (!andMatch) return [part];

  const left = andMatch[1].trim();
  const right = andMatch[2].trim();
  const leftIsFeature = Boolean(matchFeatureIntent(left, categories));
  const rightIsFeature = Boolean(matchFeatureIntent(right, categories));
  const rightIsTask = looksLikeTaskSegment(right);

  if (leftIsFeature && rightIsTask && !rightIsFeature) {
    return [left, right];
  }

  // “create folder smubia and add visa checklist” — feature left, task right
  if (
    /\bfolder\b/i.test(left) &&
    /^(?:add|put|include|create)\b/i.test(right) &&
    rightIsTask
  ) {
    const normalizedLeft = left.match(/folder/i)
      ? left
      : `create folder for ${left}`;
    if (matchFeatureIntent(normalizedLeft, categories)) {
      const task = right.replace(/^(?:add|put|include|create)\s+/i, "").trim();
      return [normalizedLeft, task];
    }
  }

  return [part];
}
