import type { InitProgressCallback } from "@mlc-ai/web-llm";

import type { Category } from "../../types";

import { buildFeatureCatalogPrompt } from "./features";
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
${buildFeatureCatalogPrompt(categories)}

Return JSON only:
{"items":[{"title":"","type":"deadline|routine|follow-up|note","categoryHint":null,"dueAt":null,"priority":false,"contactName":null}],"actions":[{"kind":"create_folder|create_area","title":"","categoryHint":null}],"clarifications":[]}

Examples:
"email prof tomorrow, gym friday" -> 2 items; follow-up + deadline; dueAt as ISO. actions [].
"follow up Google next week !" -> follow-up, priority true, contactName Google.
"create a folder for smubia" -> actions:[{kind:"create_folder",title:"Smubia"}]; items [].
"new area called Research" -> actions:[{kind:"create_area",title:"Research"}]; items [].

Dump:
${dump.trim()}`;
}

/** Skip the slow on-device model when quick parse already nailed it. */
export function shouldUseLlm(
  text: string,
  rulesItemCount: number,
  rulesActionCount = 0,
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const segments = splitDumpLines(trimmed);
  const segmentCount = Math.max(segments.length, 1);
  const covered = rulesItemCount + rulesActionCount;

  if (covered === 0) return true;

  // Feature-only dumps are already handled by rules.
  if (rulesActionCount > 0 && rulesItemCount === 0 && covered >= segmentCount) {
    return false;
  }

  if (trimmed.includes("\n") && covered >= segmentCount * 0.75) {
    return false;
  }

  if (segmentCount === 1 && covered === 1 && trimmed.length < 90) {
    return false;
  }

  if (!trimmed.includes("\n") && trimmed.length > 110) return true;

  if (segmentCount >= 2 && covered < segmentCount * 0.6) return true;

  return false;
}

export async function parseBrainDump(
  text: string,
  options: ParseDumpOptions,
): Promise<ParseDumpResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], actions: [], clarifications: [], source: "rules" };
  }

  const lines = splitDumpLines(trimmed);
  const rulesResult = parseDumpWithRules(trimmed, options.categories);
  const refinedRules: ParseDumpResult = {
    ...rulesResult,
    items: refineProposals(rulesResult.items, options.categories, lines),
  };

  const tryLlm =
    options.preferLlm !== false &&
    shouldUseLlm(
      trimmed,
      refinedRules.items.length,
      refinedRules.actions.length,
    );

  if (!tryLlm) {
    return refinedRules;
  }

  try {
    const prompt = buildParsePrompt(trimmed, options.categories);
    const raw = await generateWithPlotModel(prompt, options.onModelProgress);
    const { items, actions, clarifications } = parseModelResponse(
      raw,
      options.categories,
    );
    const refined = refineProposals(items, options.categories, lines);

    if (refined.length + actions.length >= refinedRules.items.length + refinedRules.actions.length) {
      return {
        items: refined,
        actions: actions.length > 0 ? actions : refinedRules.actions,
        clarifications,
        source: "llm",
      };
    }

    return refinedRules;
  } catch {
    return refinedRules;
  }
}
