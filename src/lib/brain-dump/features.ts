import { v4 as uuidv4 } from "uuid";

import type { Category } from "../../types";

import type { AppFeatureId, ProposedFeatureAction } from "./types";

function resolveCategoryId(
  hint: string | undefined,
  categories: Category[],
): string | undefined {
  if (!hint?.trim()) return undefined;
  const q = hint.trim().toLowerCase();
  const exact = categories.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact.id;
  return categories.find((c) => c.name.toLowerCase().startsWith(q))?.id;
}

export interface AppFeature {
  id: AppFeatureId;
  /** Short label for confirm UI */
  label: string;
  /** One-line description for the LLM prompt catalog */
  description: string;
}

export const APP_FEATURES: AppFeature[] = [
  {
    id: "create_folder",
    label: "Create folder",
    description:
      "Create a folder (project container) in an area. Phrases like “create a folder for X”, “new folder called X”, “make a folder in Work named X”.",
  },
  {
    id: "create_area",
    label: "Create area",
    description:
      "Create a top-level area (category). Phrases like “create an area for X”, “new area called X”, “add a workspace named X”.",
  },
];

const WORKSPACE_TAIL = /(?:\s+(?:workspace|area|space))?$/i;

function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(WORKSPACE_TAIL, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeName(name: string): string {
  if (!name) return name;
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveAreaHint(
  hint: string | undefined,
  categories: Category[],
): { categoryId?: string; categoryHint?: string } {
  if (!hint?.trim()) return {};
  const cleaned = cleanName(hint);
  const categoryId = resolveCategoryId(cleaned, categories);
  return {
    categoryId,
    categoryHint: cleaned,
  };
}

interface MatchedFeature {
  featureId: AppFeatureId;
  title: string;
  categoryHint?: string;
  summary: string;
}

function folderAction(
  titleRaw: string,
  categoryHint?: string,
): MatchedFeature | null {
  const title = capitalizeName(cleanName(titleRaw));
  if (title.length < 1 || title.length >= 60) return null;
  if (/^(?:a|an|the|in|under|inside|for|named|called)$/i.test(title)) {
    return null;
  }
  const area = categoryHint ? capitalizeName(cleanName(categoryHint)) : "";
  return {
    featureId: "create_folder",
    title,
    categoryHint: categoryHint ? cleanName(categoryHint) : undefined,
    summary: area ? `New folder “${title}” in ${area}` : `New folder “${title}”`,
  };
}

function areaAction(titleRaw: string): MatchedFeature | null {
  const title = capitalizeName(cleanName(titleRaw));
  if (title.length < 1 || title.length >= 40) return null;
  if (/^(?:a|an|the)$/i.test(title)) return null;
  return {
    featureId: "create_area",
    title,
    summary: `New area “${title}”`,
  };
}

/** Match one dump line against known app-feature intents. */
export function matchFeatureIntent(
  line: string,
  categories: Category[] = [],
): MatchedFeature | null {
  const text = line.trim().replace(/[.!?]+$/, "");
  if (!text) return null;

  const lead =
    /^(?:please\s+)?(?:can you\s+)?(?:create|make|add|set up|setup)\s+(?:a\s+|an\s+)?(?:new\s+)?/i;

  // folder named X in AREA / folder for X in AREA
  const folderNamedIn = text.match(
    new RegExp(
      `${lead.source}folder\\s+(?:for|named|called|titled)\\s+(.+?)\\s+(?:in|under|inside)\\s+(?:the\\s+)?(.+)$`,
      "i",
    ),
  );
  if (folderNamedIn) {
    return folderAction(folderNamedIn[1], folderNamedIn[2]);
  }

  // folder for/named/called X
  const folderNamed = text.match(
    new RegExp(
      `${lead.source}folder\\s+(?:for|named|called|titled)\\s+(.+)$`,
      "i",
    ),
  );
  if (folderNamed) {
    return folderAction(folderNamed[1]);
  }

  // folder in/under AREA (workspace) — use that name as the folder title
  const folderInArea = text.match(
    new RegExp(
      `${lead.source}folder\\s+(?:in|under|inside)\\s+(?:the\\s+)?(.+)$`,
      "i",
    ),
  );
  if (folderInArea) {
    const target = cleanName(folderInArea[1]);
    const existingArea = resolveCategoryId(target, categories);
    if (existingArea) {
      // "create a folder in Work" without a name — still track as folder
      // titled after the area so the user can rename in confirm.
      return folderAction(target, target);
    }
    return folderAction(target);
  }

  // create folder NAME (no preposition)
  const folderBare = text.match(
    new RegExp(`${lead.source}folder\\s+(.+)$`, "i"),
  );
  if (folderBare && !/^(?:in|under|inside|for|named|called)\b/i.test(folderBare[1])) {
    return folderAction(folderBare[1]);
  }

  // new folder: NAME / folder for NAME (without create verb)
  const shortFolder = text.match(
    /^(?:new\s+)?folder\s*(?::|for|named|called)\s*(.+)$/i,
  );
  if (shortFolder) {
    return folderAction(shortFolder[1]);
  }

  // create area/workspace for/named NAME
  const areaNamed = text.match(
    new RegExp(
      `${lead.source}(?:area|workspace|space)\\s+(?:for|named|called|titled)\\s+(.+)$`,
      "i",
    ),
  );
  if (areaNamed) {
    return areaAction(areaNamed[1]);
  }

  const areaBare = text.match(
    new RegExp(`${lead.source}(?:area|workspace|space)\\s+(.+)$`, "i"),
  );
  if (areaBare) {
    return areaAction(areaBare[1]);
  }

  const shortArea = text.match(
    /^(?:new\s+)?(?:area|workspace)\s*(?::|for|named|called)\s*(.+)$/i,
  );
  if (shortArea) {
    return areaAction(shortArea[1]);
  }

  return null;
}

export function featureIntentToProposal(
  match: MatchedFeature,
  categories: Category[],
): ProposedFeatureAction {
  const area = resolveAreaHint(match.categoryHint, categories);
  return {
    id: uuidv4(),
    kind: match.featureId,
    title: match.title,
    categoryId: area.categoryId ?? categories[0]?.id,
    categoryHint: area.categoryHint ?? match.categoryHint,
    summary: match.summary,
    selected: true,
  };
}

/** Prompt fragment listing features the model may emit as actions. */
export function buildFeatureCatalogPrompt(categories: Category[]): string {
  const areas = categories.map((c) => c.name).join(", ") || "Work, Personal";
  const lines = APP_FEATURES.map((f) => `- ${f.id}: ${f.description}`).join(
    "\n",
  );
  return `App features (emit these as actions, NOT as deadline/reminder items):
${lines}
Areas: ${areas}.
When the user asks to create a folder or area, return an action with kind create_folder or create_area and title set to the name. Do not invent a reminder task about creating it.`;
}

export function isFeatureActionKind(
  value: string | undefined,
): value is AppFeatureId {
  return value === "create_folder" || value === "create_area";
}

export function featureLabel(kind: AppFeatureId): string {
  return APP_FEATURES.find((f) => f.id === kind)?.label ?? kind;
}
