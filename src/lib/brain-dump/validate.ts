import { v4 as uuidv4 } from "uuid";

import type { Category, ItemType, PipelineStage } from "../../types";

import {
  featureIntentToProposal,
  featureLabel,
  isFeatureActionKind,
  matchFeatureIntent,
} from "./features";
import { isValidTask, polishTitle } from "./title-cleanup";
import type {
  ModelParsePayload,
  ProposedFeatureAction,
  ProposedItem,
} from "./types";

const ITEM_TYPES = new Set<ItemType>([
  "deadline",
  "routine",
  "follow-up",
  "note",
  "project",
]);

const PIPELINE_STAGES = new Set<PipelineStage>([
  "outreach",
  "waiting",
  "scheduling",
  "deferred",
  "my_turn",
]);

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not include JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

export function normalizeItemType(raw?: string): ItemType {
  const q = (raw ?? "deadline").toLowerCase().replace(/\s+/g, "-");
  if (q === "followup" || q === "follow-up" || q === "thread")
    return "follow-up";
  if (ITEM_TYPES.has(q as ItemType)) return q as ItemType;
  return "deadline";
}

export function normalizePipelineStage(
  raw?: string | null,
): PipelineStage | undefined {
  if (!raw) return undefined;
  const q = raw.toLowerCase().replace(/\s+/g, "_") as PipelineStage;
  return PIPELINE_STAGES.has(q) ? q : undefined;
}

export function resolveCategoryId(
  hint: string | undefined,
  categories: Category[],
): string | undefined {
  if (!hint?.trim()) return undefined;
  const q = hint.trim().toLowerCase();
  const exact = categories.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact.id;
  const prefix = categories.find((c) => c.name.toLowerCase().startsWith(q));
  return prefix?.id;
}

export function payloadToProposals(
  payload: ModelParsePayload,
  categories: Category[],
): ProposedItem[] {
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items
    .map((raw): ProposedItem | null => {
      const rawTitle = raw.title?.trim();
      if (!rawTitle) return null;

      // Model sometimes emits feature requests as fake deadline titles.
      if (matchFeatureIntent(rawTitle, categories)) return null;

      const type = normalizeItemType(raw.type);
      const categoryId = resolveCategoryId(raw.categoryHint, categories);
      const contactName = raw.contactName?.trim() || undefined;
      const title = polishTitle(rawTitle, rawTitle, type, contactName);

      if (
        !isValidTask(rawTitle, title, {
          dueAt: raw.dueAt ?? undefined,
          contactName,
          type,
        })
      ) {
        return null;
      }

      return {
        id: uuidv4(),
        title,
        type,
        categoryId,
        categoryHint: raw.categoryHint ?? undefined,
        dueAt: raw.dueAt ?? undefined,
        priority: Boolean(raw.priority),
        notes: raw.notes?.trim() || undefined,
        contactName,
        pipelineStage: normalizePipelineStage(raw.pipelineStage),
        selected: true,
      };
    })
    .filter((item): item is ProposedItem => item !== null);
}

export function payloadToActions(
  payload: ModelParsePayload,
  categories: Category[],
): ProposedFeatureAction[] {
  const rawActions = Array.isArray(payload.actions) ? payload.actions : [];
  const actions: ProposedFeatureAction[] = [];
  const seen = new Set<string>();

  for (const raw of rawActions) {
    const kind = raw.kind?.trim().toLowerCase().replace(/\s+/g, "_");
    const title = raw.title?.trim();
    if (!isFeatureActionKind(kind) || !title) continue;

    const categoryHint = raw.categoryHint?.trim() || undefined;
    const prettyTitle = title.charAt(0).toUpperCase() + title.slice(1);
    const action: ProposedFeatureAction = {
      id: uuidv4(),
      kind,
      title: prettyTitle,
      categoryId:
        resolveCategoryId(categoryHint, categories) ?? categories[0]?.id,
      categoryHint,
      summary:
        kind === "create_folder"
          ? `${featureLabel(kind)} “${prettyTitle}”${
              categoryHint ? ` in ${categoryHint}` : ""
            }`
          : `${featureLabel(kind)} “${prettyTitle}”`,
      selected: true,
    };

    const key = `${action.kind}|${action.title.toLowerCase()}|${action.categoryHint ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }

  // Recover feature intents that the model buried inside item titles.
  for (const raw of Array.isArray(payload.items) ? payload.items : []) {
    const rawTitle = raw.title?.trim();
    if (!rawTitle) continue;
    const matched = matchFeatureIntent(rawTitle, categories);
    if (!matched) continue;
    const action = featureIntentToProposal(matched, categories);
    const key = `${action.kind}|${action.title.toLowerCase()}|${action.categoryHint ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }

  return actions;
}

export function parseModelResponse(
  text: string,
  categories: Category[],
): {
  items: ProposedItem[];
  actions: ProposedFeatureAction[];
  clarifications: string[];
} {
  const parsed = extractJsonObject(text) as ModelParsePayload;
  const items = payloadToProposals(parsed, categories);
  const actions = payloadToActions(parsed, categories);
  const clarifications = Array.isArray(parsed.clarifications)
    ? parsed.clarifications.filter(
        (c): c is string => typeof c === "string" && c.trim().length > 0,
      )
    : [];

  if (items.length === 0 && actions.length === 0) {
    throw new Error("No tasks or app actions found in the model response.");
  }

  return { items, actions, clarifications };
}
