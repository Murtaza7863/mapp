import type { InitProgressCallback } from "@mlc-ai/web-llm";

import type { Category } from "../../types";

import { generatePlotParse } from "./llm-engine";
import { mergePlotProposals } from "./merge-proposals";
import { refineProposals } from "./refine-proposals";
import { parseDumpWithRules, splitDumpLines } from "./rules-parser";
import type { ParseDumpResult } from "./types";
import { parseModelResponse } from "./validate";

export interface ParseDumpOptions {
  categories: Category[];
  preferLlm?: boolean;
  onModelProgress?: InitProgressCallback;
}

function refineRulesResult(
  text: string,
  categories: Category[],
): ParseDumpResult {
  const lines = splitDumpLines(text);
  const rulesResult = parseDumpWithRules(text, categories);
  return {
    ...rulesResult,
    items: refineProposals(rulesResult.items, categories, lines),
  };
}

/** Fast rules-only parse — synchronous, for instant confirm preview. */
export function parseRulesDump(
  text: string,
  categories: Category[],
): ParseDumpResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], actions: [], clarifications: [], source: "rules" };
  }
  return refineRulesResult(trimmed, categories);
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

  if (
    trimmed.length > 140 &&
    /(?:finished|talked|just|need to|waiting on)/i.test(trimmed)
  ) {
    return true;
  }

  return false;
}

/** Run on-device model when quick parse needs a boost. Returns null to keep rules. */
export async function refineDumpWithLlm(
  text: string,
  categories: Category[],
  rulesResult: ParseDumpResult,
  onModelProgress?: InitProgressCallback,
): Promise<ParseDumpResult | null> {
  const trimmed = text.trim();
  if (
    !trimmed ||
    !shouldUseLlm(trimmed, rulesResult.items.length, rulesResult.actions.length)
  ) {
    return null;
  }

  const lines = splitDumpLines(trimmed);
  const raw = await generatePlotParse({
    dump: trimmed,
    categories,
    rulesPreview: rulesResult.items,
    onProgress: onModelProgress,
  });

  const { items, actions, clarifications } = parseModelResponse(
    raw,
    categories,
  );
  const refinedLlm = refineProposals(items, categories, lines);
  const mergedItems = mergePlotProposals(rulesResult.items, refinedLlm);
  const mergedActions = actions.length > 0 ? actions : rulesResult.actions;

  if (mergedItems.length === 0 && mergedActions.length === 0) return null;

  const improved =
    mergedItems.length > rulesResult.items.length ||
    mergedActions.length > rulesResult.actions.length ||
    mergedItems.some((item, i) => {
      const rule = rulesResult.items[i];
      if (!rule) return true;
      return (
        item.dueAt !== rule.dueAt ||
        item.type !== rule.type ||
        item.contactName !== rule.contactName ||
        item.categoryId !== rule.categoryId
      );
    });

  if (!improved && rulesResult.items.length + rulesResult.actions.length > 0) {
    return null;
  }

  return {
    items: mergedItems,
    actions: mergedActions,
    clarifications: [...rulesResult.clarifications, ...clarifications],
    source: "llm",
  };
}

export async function parseBrainDump(
  text: string,
  options: ParseDumpOptions,
): Promise<ParseDumpResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], actions: [], clarifications: [], source: "rules" };
  }

  const refinedRules = refineRulesResult(trimmed, options.categories);

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
    const llmResult = await refineDumpWithLlm(
      trimmed,
      options.categories,
      refinedRules,
      options.onModelProgress,
    );
    return llmResult ?? refinedRules;
  } catch {
    return refinedRules;
  }
}
