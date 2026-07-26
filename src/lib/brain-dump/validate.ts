import { v4 as uuidv4 } from "uuid";

import type { Category, ItemType, PipelineStage } from "../../types";

import type { ModelParsePayload, ProposedItem } from "./types";
import { isValidTask, polishTitle } from "./title-cleanup";

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

export function parseModelResponse(
  text: string,
  categories: Category[],
): { items: ProposedItem[]; clarifications: string[] } {
  const parsed = extractJsonObject(text) as ModelParsePayload;
  const items = payloadToProposals(parsed, categories);
  const clarifications = Array.isArray(parsed.clarifications)
    ? parsed.clarifications.filter(
        (c): c is string => typeof c === "string" && c.trim().length > 0,
      )
    : [];

  if (items.length === 0) {
    throw new Error("No tasks found in the model response.");
  }

  return { items, clarifications };
}
