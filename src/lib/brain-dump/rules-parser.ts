import { v4 as uuidv4 } from "uuid";

import type { Category, ItemType } from "../../types";
import { parseQuickAdd } from "../quickadd";

import { extractContact } from "./contacts";
import { featureIntentToProposal, matchFeatureIntent } from "./features";
import {
  CONTEXT_MERGE_SEP,
  isValidTask,
  looksLikeTaskSegment,
  parseContextClause,
  polishTitle,
} from "./title-cleanup";
import type {
  ParseDumpResult,
  ProposedFeatureAction,
  ProposedItem,
} from "./types";
import { resolveCategoryId } from "./validate";

const FOLLOW_UP_RE =
  /\b(follow[- ]?up|reach out|email|call|text|bump|waiting on|check in with)\b/i;
const ROUTINE_RE =
  /\b(routine|every day|daily|weekly|gym|habit|each morning|each evening)\b/i;
const NOTE_RE = /^note:\s*/i;
const PROJECT_RE = /^project:\s*/i;

function cleanListLine(line: string): string {
  return line
    .replace(/^[\s]*[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function mergeContextCommaParts(parts: string[]): string[] {
  const merged: string[] = [];
  let pendingContext: string | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (parseContextClause(trimmed)) {
      pendingContext = trimmed;
      continue;
    }

    if (pendingContext) {
      merged.push(`${pendingContext}${CONTEXT_MERGE_SEP}${trimmed}`);
      pendingContext = null;
      continue;
    }

    merged.push(trimmed);
  }

  return merged;
}

export function splitDumpLines(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  if (!normalized.includes("\n")) {
    const commaParts = normalized
      .split(/,\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (commaParts.length >= 2) {
      const merged = mergeContextCommaParts(commaParts);
      const taskParts = merged.filter((part) => {
        const taskOnly = part.includes(CONTEXT_MERGE_SEP)
          ? part.split(CONTEXT_MERGE_SEP, 2)[1]!
          : part;
        return looksLikeTaskSegment(taskOnly);
      });
      if (taskParts.length >= 1 && taskParts.length === merged.length) {
        return taskParts.map(cleanListLine);
      }
      if (
        commaParts.length >= 2 &&
        commaParts.every((part) => looksLikeTaskSegment(part))
      ) {
        return commaParts.map(cleanListLine);
      }
    }
  }

  const chunks = normalized.split(/\n+/).map(cleanListLine).filter(Boolean);

  return chunks.length > 0 ? chunks : [normalized].filter(Boolean);
}

export function inferTypeFromLine(line: string): ItemType {
  if (NOTE_RE.test(line)) return "note";
  if (PROJECT_RE.test(line)) return "project";
  if (FOLLOW_UP_RE.test(line)) return "follow-up";
  if (ROUTINE_RE.test(line)) return "routine";
  return "deadline";
}

export function stripTypePrefix(line: string): string {
  return line
    .replace(NOTE_RE, "")
    .replace(PROJECT_RE, "")
    .replace(/^(follow[- ]?up|fu|deadline|task|routine):\s*/i, "")
    .trim();
}

function splitContextTaskLine(line: string): {
  taskLine: string;
  contextContact?: string;
} {
  if (!line.includes(CONTEXT_MERGE_SEP)) {
    return { taskLine: line };
  }
  const [contextPart, taskPart] = line.split(CONTEXT_MERGE_SEP, 2);
  const context = parseContextClause(contextPart.trim());
  if (!context || !taskPart?.trim()) {
    return { taskLine: line };
  }
  return { taskLine: taskPart.trim(), contextContact: context.contactName };
}

function lineToProposal(
  line: string,
  categories: Category[],
  now: Date,
): ProposedItem | null {
  const { taskLine, contextContact } = splitContextTaskLine(line);
  const cleaned = stripTypePrefix(taskLine);
  if (!cleaned || !looksLikeTaskSegment(cleaned)) return null;

  const inferredType = inferTypeFromLine(taskLine);
  const parsed = parseQuickAdd(cleaned, categories, now);
  if (!parsed.title.trim()) return null;

  const contactName = contextContact ?? extractContact(taskLine);
  const type = parsed.type ?? inferredType;
  const title = polishTitle(
    parsed.title,
    taskLine,
    type,
    contactName,
    contextContact,
  );

  if (
    !isValidTask(taskLine, title, {
      dueAt: parsed.dueAt,
      contactName,
      type,
    })
  ) {
    return null;
  }

  const categoryId =
    parsed.categoryId ??
    resolveCategoryId(parsed.categoryName, categories) ??
    categories[0]?.id;

  return {
    id: uuidv4(),
    title,
    type,
    categoryId,
    categoryHint: parsed.categoryName,
    dueAt: parsed.dueAt,
    priority: parsed.priority,
    contactName,
    selected: true,
    ...(type === "follow-up" ? { pipelineStage: "outreach" as const } : {}),
  };
}

export function parseDumpWithRules(
  text: string,
  categories: Category[],
  now: Date = new Date(),
): ParseDumpResult {
  const lines = splitDumpLines(text);
  const items: ProposedItem[] = [];
  const actions: ProposedFeatureAction[] = [];
  const seenItems = new Set<string>();
  const seenActions = new Set<string>();

  for (const line of lines) {
    const feature = matchFeatureIntent(line, categories);
    if (feature) {
      const action = featureIntentToProposal(feature, categories);
      const key = `${action.kind}|${action.title.toLowerCase()}|${action.categoryHint ?? ""}`;
      if (!seenActions.has(key)) {
        seenActions.add(key);
        actions.push(action);
      }
      continue;
    }

    const proposal = lineToProposal(line, categories, now);
    if (!proposal) continue;
    const key = `${proposal.title.toLowerCase()}|${proposal.dueAt ?? ""}`;
    if (seenItems.has(key)) continue;
    seenItems.add(key);
    items.push(proposal);
  }

  const clarifications: string[] = [];
  if (items.some((i) => i.type === "routine" && !i.dueAt)) {
    clarifications.push(
      "Some routines may need a schedule — you can edit them before saving.",
    );
  }

  return { items, actions, clarifications, source: "rules" };
}
