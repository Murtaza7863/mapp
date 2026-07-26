import type { InitProgressCallback } from "@mlc-ai/web-llm";

import type { Category } from "../../types";

import { generateWithPlotModel } from "./llm-engine";
import { refineProposals } from "./refine-proposals";
import { parseDumpWithRules, splitDumpLines } from "./rules-parser";
import type { ParseDumpResult } from "./types";
import { parseModelResponse } from "./validate";

export interface ParseDumpOptions {
  categories: Category[];
  preferLlm?: boolean;
  onModelProgress?: InitProgressCallback;
}

function buildParsePrompt(dump: string, categories: Category[]): string {
  const areas = categories.map((c) => c.name).join(", ") || "Work, Personal";
  const today = new Date().toISOString().slice(0, 10);

  return `Today: ${today}. Areas: ${areas}.
Return JSON only:
{"items":[{"title":"","type":"deadline|routine|follow-up|note","categoryHint":null,"dueAt":null,"priority":false,"contactName":null}],"clarifications":[]}

Examples:
"email prof tomorrow, gym friday" -> 2 items; follow-up + deadline; dueAt as ISO.
"follow up Google next week !" -> follow-up, priority true, contactName Google.

Dump:
${dump.trim()}`;
}

/** Skip the slow on-device model when quick parse already nailed it. */
export function shouldUseLlm(text: string, rulesItemCount: number): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const segments = splitDumpLines(trimmed);
  const segmentCount = Math.max(segments.length, 1);

  if (rulesItemCount === 0) return true;

  if (trimmed.includes("\n") && rulesItemCount >= segmentCount * 0.75) {
    return false;
  }

  if (segmentCount === 1 && rulesItemCount === 1 && trimmed.length < 90) {
    return false;
  }

  if (!trimmed.includes("\n") && trimmed.length > 110) return true;

  if (segmentCount >= 2 && rulesItemCount < segmentCount * 0.6) return true;

  return false;
}

export async function parseBrainDump(
  text: string,
  options: ParseDumpOptions,
): Promise<ParseDumpResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], clarifications: [], source: "rules" };
  }

  const lines = splitDumpLines(trimmed);
  const rulesResult = parseDumpWithRules(trimmed, options.categories);
  const refinedRules: ParseDumpResult = {
    ...rulesResult,
    items: refineProposals(rulesResult.items, options.categories, lines),
  };

  const tryLlm =
    options.preferLlm !== false &&
    shouldUseLlm(trimmed, refinedRules.items.length);

  if (!tryLlm) {
    return refinedRules;
  }

  try {
    const prompt = buildParsePrompt(trimmed, options.categories);
    const raw = await generateWithPlotModel(prompt, options.onModelProgress);
    const { items, clarifications } = parseModelResponse(
      raw,
      options.categories,
    );
    const refined = refineProposals(items, options.categories, lines);

    if (refined.length >= refinedRules.items.length) {
      return { items: refined, clarifications, source: "llm" };
    }

    return refinedRules;
  } catch {
    return refinedRules;
  }
}
