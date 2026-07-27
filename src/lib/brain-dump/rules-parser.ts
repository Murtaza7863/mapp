import { v4 as uuidv4 } from "uuid";

import type { Category, ItemType } from "../../types";
import { parseQuickAdd } from "../quickadd";

import { stripAreaSuffix } from "./area-hints";
import { extractContact } from "./contacts";
import { featureIntentToProposal, matchFeatureIntent } from "./features";
import { parsePlotStructure, structureSummary } from "./structure-parser";
import { parseFolderTaskLine, type FolderTaskParse } from "./folder-parse";
import { expandLineSegments } from "./line-split";
import {
  normalizePlotLine,
  parseFolderCompoundRamble,
  splitRambleSentences,
} from "./ramble";
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

/** Explicit open-loop cues — these are always follow-ups. */
const EXPLICIT_FOLLOW_UP_RE =
  /\b(follow[- ]?up|reach out|waiting on|check in with|bump)\b/i;
/** Soft contact verbs — only follow-ups when there's no date (else a normal task). */
const SOFT_CONTACT_VERB_RE = /\b(email|call|text)\b/i;
const ROUTINE_RE =
  /\b(routine|every day|every\s+(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|gym|habit|each morning|each evening)\b/i;
const NOTE_RE = /^note:\s*/i;
const JOT_NOTE_RE = /^(?:jot down|write down|capture)\s*:\s*/i;
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

function splitCommaRespectingParens(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    if (ch === ")" && depth > 0) depth -= 1;
    if (ch === "," && depth === 0) {
      const next = text.slice(i + 1);
      if (/^\s+/.test(next)) {
        parts.push(text.slice(start, i).trim());
        start = i + 1;
        while (start < text.length && /\s/.test(text[start]!)) start += 1;
        i = start - 1;
      }
    }
  }

  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

export function splitDumpLines(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  if (normalized.includes("\n")) {
    return normalized.split(/\n+/).flatMap((chunk) => splitDumpLines(chunk));
  }

  const rambleLines = splitRambleSentences(normalized);
  if (rambleLines.length > 1) {
    return rambleLines.flatMap((line) => splitDumpLines(line));
  }

  const line = normalizePlotLine(normalized);

  if (!line.includes("\n")) {
    const commaParts = splitCommaRespectingParens(line)
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

  const chunks = line
    .split(/\n+/)
    .flatMap((chunk) => {
      const pieces = chunk.includes(";")
        ? chunk.split(/\s*;\s*/)
        : chunk.includes("|")
          ? chunk.split(/\s*\|\s*/)
          : [chunk];
      return pieces.map(cleanListLine).filter(Boolean);
    })
    .filter(Boolean);

  return chunks.length > 0 ? chunks : [line].filter(Boolean);
}

export function inferTypeFromLine(
  line: string,
  opts: { hasDueAt?: boolean } = {},
): ItemType {
  if (NOTE_RE.test(line) || JOT_NOTE_RE.test(line)) return "note";
  if (PROJECT_RE.test(line)) return "project";
  if (/^fu:\s*/i.test(line) || EXPLICIT_FOLLOW_UP_RE.test(line)) {
    return "follow-up";
  }
  // "email jake" / "call mom" with no day → open loop. With a day → dated task.
  if (SOFT_CONTACT_VERB_RE.test(line) && !opts.hasDueAt) return "follow-up";
  if (ROUTINE_RE.test(line)) return "routine";
  return "deadline";
}

export function stripTypePrefix(line: string): string {
  return line
    .replace(NOTE_RE, "")
    .replace(JOT_NOTE_RE, "")
    .replace(PROJECT_RE, "")
    .replace(/^(follow[- ]?up|fu|deadline|task|todo|routine):\s*/i, "")
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

function folderDisplayName(folder: FolderTaskParse): string {
  if (
    folder.childGroup &&
    !folder.folderName.toLowerCase().includes(folder.childGroup.toLowerCase())
  ) {
    return `${folder.folderName} ${folder.childGroup}`;
  }
  return folder.folderName;
}

function shouldUseEarlyFolderParse(cleaned: string): boolean {
  return (
    /\bput\s+.+\s+in\s+.+folder\s*$/i.test(cleaned) ||
    /\bfolder\s*:/i.test(cleaned)
  );
}

function lineToProposal(
  line: string,
  categories: Category[],
  now: Date,
  options: { parentFolderName?: string; categoryId?: string } = {},
): ProposedItem | null {
  const { taskLine, contextContact } = splitContextTaskLine(line);
  const cleaned = stripTypePrefix(taskLine);
  if (!cleaned) return null;

  const earlyFolder = parseFolderTaskLine(cleaned);
  let structure: ReturnType<typeof parsePlotStructure>;
  let parseText: string;
  let folderTask: FolderTaskParse | null = null;

  if (earlyFolder && shouldUseEarlyFolderParse(cleaned)) {
    const areaMatch = categories.find(
      (c) => c.name.toLowerCase() === earlyFolder.folderName.toLowerCase(),
    );
    structure = {
      areaName: areaMatch?.name,
      createArea: false,
      folderName: folderDisplayName(earlyFolder),
      childGroup: earlyFolder.childGroup,
      taskText: earlyFolder.taskTitle,
    };
    parseText = earlyFolder.taskTitle;
    folderTask = earlyFolder;
  } else {
    structure = parsePlotStructure(cleaned, categories);
    parseText = structure.taskText.trim();
  }

  const areaStripped = stripAreaSuffix(parseText, categories);
  parseText = areaStripped.text;

  const category =
    categories.find(
      (c) => c.id === (options.categoryId ?? areaStripped.categoryId),
    ) ??
    categories.find(
      (c) =>
        areaStripped.categoryHint &&
        c.name
          .toLowerCase()
          .startsWith(areaStripped.categoryHint.toLowerCase()),
    );

  if (!earlyFolder || !shouldUseEarlyFolderParse(cleaned)) {
    const folderFallback = !/^new\s+area\b/i.test(cleaned)
      ? parseFolderTaskLine(cleaned, category)
      : null;
    if (folderFallback && !structure.folderName) {
      structure = {
        ...structure,
        folderName: folderDisplayName(folderFallback),
        childGroup: folderFallback.childGroup ?? structure.childGroup,
        taskText: folderFallback.taskTitle,
      };
      parseText = folderFallback.taskTitle;
    }

    folderTask = parseFolderTaskLine(parseText, category);
    if (folderTask) {
      parseText = folderTask.taskTitle;
      structure = {
        ...structure,
        folderName:
          structure.folderName ??
          folderDisplayName(folderTask) ??
          options.parentFolderName,
        childGroup: structure.childGroup ?? folderTask.childGroup,
        taskText: parseText,
      };
    } else if (options.parentFolderName && !structure.folderName) {
      structure = {
        ...structure,
        folderName: options.parentFolderName,
      };
    }
  }

  const hasExplicitType =
    /^(?:note|follow[- ]?up|fu|deadline|task|todo|routine|project|jot down|write down|capture):/i.test(
      taskLine,
    );
  if (
    !parseText ||
    (!folderTask && !looksLikeTaskSegment(parseText) && !hasExplicitType)
  ) {
    return null;
  }

  const parsed = parseQuickAdd(parseText, categories, now);
  if (!parsed.title.trim()) return null;

  const inferredType = inferTypeFromLine(taskLine, {
    hasDueAt: Boolean(parsed.dueAt),
  });
  const contactName = contextContact ?? extractContact(parseText);
  const type = parsed.type ?? inferredType;
  const categoryNames = categories.map((c) => c.name);
  const title = polishTitle(
    parsed.title,
    parseText,
    type,
    contactName,
    contextContact,
    categoryNames,
  );

  if (
    !isValidTask(parseText, title, {
      dueAt: parsed.dueAt,
      contactName,
      type,
    })
  ) {
    return null;
  }

  const matchedCategory = structure.areaName
    ? categories.find(
        (c) => c.name.toLowerCase() === structure.areaName!.toLowerCase(),
      )
    : undefined;

  const categoryId =
    options.categoryId ??
    areaStripped.categoryId ??
    parsed.categoryId ??
    matchedCategory?.id ??
    resolveCategoryId(structure.areaName ?? parsed.categoryName, categories) ??
    categories[0]?.id;

  const planNotes = structureSummary(structure);

  return {
    id: uuidv4(),
    title,
    type,
    categoryId,
    categoryHint:
      structure.areaName ?? areaStripped.categoryHint ?? parsed.categoryName,
    parentFolderName: structure.folderName,
    childGroup: structure.childGroup,
    structure,
    planNotes: planNotes.length > 0 ? planNotes : undefined,
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
  let pendingFolder: string | undefined;

  for (const line of lines) {
    const normalizedLine = normalizePlotLine(line);
    const compoundFolder = parseFolderCompoundRamble(normalizedLine);
    if (compoundFolder) {
      const feature = matchFeatureIntent(
        `create folder for ${compoundFolder.folderName}`,
        categories,
      );
      if (feature) {
        const action = featureIntentToProposal(feature, categories);
        const key = `${action.kind}|${action.title.toLowerCase()}|${action.categoryHint ?? ""}`;
        if (!seenActions.has(key)) {
          seenActions.add(key);
          actions.push(action);
        }
        pendingFolder = feature.title;
      }
      const proposal = lineToProposal(
        compoundFolder.taskTitle,
        categories,
        now,
        {
          parentFolderName: pendingFolder ?? compoundFolder.folderName,
        },
      );
      if (proposal) {
        const key = `${proposal.title.toLowerCase()}|${proposal.parentFolderName ?? ""}|${proposal.dueAt ?? ""}`;
        if (!seenItems.has(key)) {
          seenItems.add(key);
          items.push(proposal);
        }
      }
      pendingFolder = undefined;
      continue;
    }

    const segments = expandLineSegments(normalizedLine, categories);
    for (const segment of segments) {
      const feature = matchFeatureIntent(segment, categories);
      if (feature) {
        const action = featureIntentToProposal(feature, categories);
        const key = `${action.kind}|${action.title.toLowerCase()}|${action.categoryHint ?? ""}`;
        if (!seenActions.has(key)) {
          seenActions.add(key);
          actions.push(action);
        }
        if (feature.featureId === "create_folder") {
          pendingFolder = feature.title;
        }
        continue;
      }

      const proposal = lineToProposal(segment, categories, now, {
        parentFolderName: pendingFolder,
      });
      if (!proposal) continue;
      pendingFolder = undefined;

      const key = `${proposal.title.toLowerCase()}|${proposal.parentFolderName ?? ""}|${proposal.dueAt ?? ""}`;
      if (seenItems.has(key)) continue;
      seenItems.add(key);
      items.push(proposal);
    }
  }

  const clarifications: string[] = [];
  if (items.some((i) => i.type === "routine" && !i.dueAt)) {
    clarifications.push(
      "Some routines may need a schedule — you can edit them before saving.",
    );
  }

  return { items, actions, clarifications, source: "rules" };
}
