import type { Category } from "../../types";
import { parseContainerQuickAdd } from "../containers";

import { findCategoryInText, stripCategoryMentions } from "./category-hints";

export interface PlotStructure {
  areaName?: string;
  createArea?: boolean;
  ensureSubgroups?: string[];
  folderName?: string;
  childGroup?: string;
  taskText: string;
}

const CREATE_AREA_RE =
  /\b(?:new|create)\s+area\s+([#@]?[A-Za-z][\w]+(?:\s+[A-Za-z][\w]+)*)(?:\s*\(([^)]+)\))?\s*/i;

const FOR_AREA_TAIL_RE =
  /\bfor\s+(?:area\s+)?([#@]?[A-Za-z][\w]+(?:\s+[A-Za-z][\w]+)*)\s*$/i;

const PREP_AREA_TAIL_RE =
  /\b(?:in|on|under)\s+(?:area\s+)?([#@]?[A-Za-z][\w]+(?:\s+[A-Za-z][\w]+)*)\s*$/i;

const NON_AREA_FOR_HINTS =
  /^(?:feedback|slides|review|approval|response|reply|help|support|dinner|lunch|breakfast|class|meeting|interview|internship|them|him|her|us|you|me|now|later|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;

const FOR_UNDER_RE = /\bfor\s+([A-Za-z][\w\s-]+?)\s+under\s+(.+?)\s*-\s*(.+)$/i;

const PATH_SPLIT_RE = /\s*(?:>|\/|→)\s*/;

const VERB_START =
  /^(?:need|email|call|follow|send|pay|buy|book|prep|finish|submit|meet|complete|write|read|fix|schedule|apply|study|review|gym|remember|have|gotta|just)\b/i;

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseSubgroupList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => capitalize(s.trim()))
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function categoryByName(
  categories: Category[],
  name: string,
): Category | undefined {
  const q = name.trim().toLowerCase();
  return categories.find((c) => c.name.toLowerCase() === q);
}

function stripLeadingArea(text: string, areaName: string): string {
  const esc = escapeRegExp(areaName);
  return text
    .replace(new RegExp(`^${esc}\\s*[:>/-]?\\s*`, "i"), "")
    .replace(new RegExp(`^${esc}\\b\\s*`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAreaName(
  hint: string,
  categories: Category[],
): { name: string; createArea: boolean } {
  const existing = categoryByName(categories, hint);
  if (existing) return { name: existing.name, createArea: false };
  return { name: capitalize(hint), createArea: true };
}

function looksLikeAreaHint(hint: string, categories: Category[]): boolean {
  const trimmed = hint.replace(/^[#@]/, "").trim();
  if (!trimmed || NON_AREA_FOR_HINTS.test(trimmed)) return false;
  if (categoryByName(categories, trimmed)) return true;
  if (/^[A-Z][A-Z0-9]{2,}$/.test(trimmed)) return true;
  if (/^[#@]/.test(hint)) return true;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(trimmed)) return true;
  return false;
}

function tryExplicitAreaTail(
  remaining: string,
  categories: Category[],
): { areaName: string; createArea: boolean; remaining: string } | null {
  const forTail = remaining.match(FOR_AREA_TAIL_RE);
  if (forTail) {
    const hint = forTail[1].replace(/^[#@]/, "").trim();
    if (looksLikeAreaHint(forTail[1], categories)) {
      const resolved = resolveAreaName(hint, categories);
      return {
        areaName: resolved.name,
        createArea: resolved.createArea,
        remaining: remaining.replace(forTail[0], "").trim(),
      };
    }
  }

  const prepTail = remaining.match(PREP_AREA_TAIL_RE);
  if (prepTail) {
    const hint = prepTail[1].replace(/^[#@]/, "").trim();
    const existing = categoryByName(categories, hint);
    if (existing) {
      return {
        areaName: existing.name,
        createArea: false,
        remaining: remaining.replace(prepTail[0], "").trim(),
      };
    }
    if (
      /\barea\s+/i.test(prepTail[0]) &&
      looksLikeAreaHint(prepTail[1], categories)
    ) {
      const resolved = resolveAreaName(hint, categories);
      return {
        areaName: resolved.name,
        createArea: resolved.createArea,
        remaining: remaining.replace(prepTail[0], "").trim(),
      };
    }
  }

  return null;
}

function parseColonStructure(
  left: string,
  taskText: string,
  subgroups: string[],
): Pick<PlotStructure, "folderName" | "childGroup" | "taskText"> {
  const container = parseContainerQuickAdd(`${left}: ${taskText}`, subgroups);
  if (container) {
    return {
      folderName: container.folderName,
      childGroup: container.childGroup,
      taskText: container.taskTitle,
    };
  }

  const twoWord = left.match(/^(.+)\s+([A-Za-z][\w-]+)$/);
  if (twoWord && subgroups.length > 0) {
    const [, folderPart, groupToken] = twoWord;
    const matched = subgroups.find(
      (s) => s.toLowerCase() === groupToken.toLowerCase(),
    );
    if (matched) {
      return {
        folderName: folderPart.trim(),
        childGroup: matched,
        taskText,
      };
    }
  }

  if (!left.includes(" ") && left.length >= 3 && left.length < 30) {
    return {
      childGroup: capitalize(left),
      taskText,
    };
  }

  if (left.length > 0 && left.length < 60) {
    return { folderName: left.trim(), taskText };
  }

  return { taskText: `${left}: ${taskText}`.trim() };
}

function parsePathSegments(
  segments: string[],
  subgroups: string[],
  areaName?: string,
): PlotStructure {
  if (segments.length === 0) return { taskText: "" };
  if (segments.length === 1) return { taskText: segments[0], areaName };

  const last = segments[segments.length - 1];
  const colonInLast = last.match(/^(.+?):\s+(.+)$/);
  if (colonInLast) {
    const prefix = [...segments.slice(0, -1), colonInLast[1]].join(" ");
    return {
      areaName,
      ...parseColonStructure(prefix, colonInLast[2], subgroups),
    };
  }

  if (segments.length === 2) {
    return { areaName, folderName: segments[0], taskText: segments[1] };
  }

  if (segments.length === 3) {
    return {
      areaName,
      folderName: segments[0],
      childGroup: capitalize(segments[1]),
      taskText: segments[2],
      ensureSubgroups: [capitalize(segments[1])],
    };
  }

  return {
    areaName: areaName ?? segments[0],
    folderName: segments[1],
    childGroup: capitalize(segments[2]),
    taskText: segments[segments.length - 1],
    ensureSubgroups: [capitalize(segments[2])],
  };
}

function finalizeStructure(
  base: PlotStructure,
  ensureSubgroups: string[],
): PlotStructure {
  const merged = [...ensureSubgroups];
  if (base.childGroup) merged.push(base.childGroup);
  const unique = merged.filter(
    (sg, i, arr) =>
      arr.findIndex((x) => x.toLowerCase() === sg.toLowerCase()) === i,
  );
  return {
    ...base,
    ensureSubgroups: unique.length > 0 ? unique : base.ensureSubgroups,
  };
}

/** Parse area / folder / subgroup hierarchy from natural plot text. */
export function parsePlotStructure(
  text: string,
  categories: Category[],
): PlotStructure {
  let remaining = text.trim();
  if (!remaining) return { taskText: "" };

  let createArea = false;
  let areaName: string | undefined;
  let ensureSubgroups: string[] = [];

  const forUnder = remaining.match(FOR_UNDER_RE);
  if (forUnder) {
    const resolved = resolveAreaName(forUnder[1].trim(), categories);
    areaName = resolved.name;
    createArea = resolved.createArea;
    return finalizeStructure(
      {
        areaName,
        createArea,
        folderName: forUnder[2].trim(),
        taskText: forUnder[3].trim(),
      },
      ensureSubgroups,
    );
  }

  const createMatch = remaining.match(CREATE_AREA_RE);
  if (createMatch) {
    createArea = true;
    areaName = createMatch[1].replace(/^[#@]/, "").trim();
    if (createMatch[2]) ensureSubgroups = parseSubgroupList(createMatch[2]);
    remaining = remaining.slice(createMatch[0].length).trim();
  }

  const explicitTail = tryExplicitAreaTail(remaining, categories);
  if (explicitTail) {
    areaName = explicitTail.areaName;
    createArea = explicitTail.createArea;
    remaining = explicitTail.remaining;
  }

  if (!areaName) {
    const found = findCategoryInText(remaining, categories);
    if (found) {
      areaName = found.name;
      remaining = stripLeadingArea(remaining, found.name);
      remaining = stripCategoryMentions(remaining, found.name);
    }
  }

  if (!areaName) {
    const hash = remaining.match(/\s#([\w-]+)(?=\s|$)/i);
    if (hash) {
      const resolved = resolveAreaName(hash[1], categories);
      areaName = resolved.name;
      createArea = resolved.createArea;
      remaining = remaining.replace(hash[0], " ").trim();
    }
  }

  if (!areaName) {
    const lead = remaining.match(
      /^([A-Z][A-Z0-9]{2,}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b\s+/,
    );
    if (lead && !VERB_START.test(lead[1])) {
      const resolved = resolveAreaName(lead[1].trim(), categories);
      areaName = resolved.name;
      createArea = resolved.createArea;
      remaining = stripLeadingArea(remaining, lead[1].trim());
    }
  }

  if (areaName) {
    remaining = stripLeadingArea(remaining, areaName);
  }

  const cat = areaName ? categoryByName(categories, areaName) : undefined;
  const subgroups = [...(cat?.subgroups ?? []), ...ensureSubgroups];

  if (PATH_SPLIT_RE.test(remaining)) {
    const segments = remaining
      .split(PATH_SPLIT_RE)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsed = parsePathSegments(segments, subgroups, areaName);
    return finalizeStructure(
      {
        areaName: parsed.areaName ?? areaName,
        createArea,
        folderName: parsed.folderName,
        childGroup: parsed.childGroup,
        taskText: parsed.taskText || remaining,
      },
      [...ensureSubgroups, ...(parsed.ensureSubgroups ?? [])],
    );
  }

  const colon = remaining.match(/^(.+?):\s+(.+)$/);
  if (colon) {
    const parsed = parseColonStructure(colon[1], colon[2], subgroups);
    return finalizeStructure(
      {
        areaName,
        createArea,
        folderName: parsed.folderName,
        childGroup: parsed.childGroup,
        taskText: parsed.taskText,
      },
      ensureSubgroups,
    );
  }

  const underFolder = remaining.match(
    /\b(?:in|under)\s+(?:folder\s+)?(.+?)\s*[-,]\s*(.+)$/i,
  );
  if (underFolder) {
    return finalizeStructure(
      {
        areaName,
        createArea,
        folderName: underFolder[1].trim(),
        taskText: underFolder[2].trim(),
      },
      ensureSubgroups,
    );
  }

  return finalizeStructure(
    {
      areaName,
      createArea: createArea || Boolean(areaName && !cat),
      taskText: remaining,
    },
    ensureSubgroups,
  );
}

export function structureSummary(structure: PlotStructure): string[] {
  const notes: string[] = [];
  if (structure.createArea && structure.areaName) {
    notes.push(`Will create area “${structure.areaName}”`);
  }
  if (structure.ensureSubgroups?.length) {
    notes.push(`Subgroups: ${structure.ensureSubgroups.join(", ")}`);
  }
  if (structure.folderName) {
    notes.push(
      structure.childGroup
        ? `Folder “${structure.folderName}” · ${structure.childGroup}`
        : `Folder “${structure.folderName}”`,
    );
  }
  return notes;
}
