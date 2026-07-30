import type { InitProgressCallback } from "@mlc-ai/web-llm";

import type { Category, Item } from "../../types";

import { generatePlotParse } from "./llm-engine";
import { mergePlotProposals } from "./merge-proposals";
import { refineProposals } from "./refine-proposals";
import { resolveActionTargets } from "./resolve-target";
import { parseDumpWithRules, splitDumpLines } from "./rules-parser";
import type { ParseDumpResult } from "./types";
import { parseModelResponse } from "./validate";

export interface ParseDumpOptions {
  categories: Category[];
  preferLlm?: boolean;
  onModelProgress?: InitProgressCallback;
  /** Existing items — used to resolve complete/snooze/delete targets */
  items?: Item[];
}

function attachTargets(
  result: ParseDumpResult,
  items: Item[] | undefined,
): ParseDumpResult {
  if (!items?.length || result.actions.length === 0) return result;
  return {
    ...result,
    actions: resolveActionTargets(result.actions, items),
  };
}

function refineRulesResult(
  text: string,
  categories: Category[],
  items?: Item[],
): ParseDumpResult {
  const lines = splitDumpLines(text);
  const rulesResult = parseDumpWithRules(text, categories);
  return attachTargets(
    {
      ...rulesResult,
      items: refineProposals(rulesResult.items, categories, lines),
    },
    items,
  );
}

/** Fast rules-only parse — synchronous, for instant confirm preview. */
export function parseRulesDump(
  text: string,
  categories: Category[],
  items: Item[] = [],
): ParseDumpResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], actions: [], clarifications: [], source: "rules" };
  }
  return refineRulesResult(trimmed, categories, items);
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
  pendingItems: Item[] = [],
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
    pendingItems,
    onProgress: onModelProgress,
  });

  const { items, actions, clarifications } = parseModelResponse(
    raw,
    categories,
  );
  const refinedLlm = refineProposals(items, categories, lines);
  const mergedItems = mergePlotProposals(rulesResult.items, refinedLlm);
  // Prefer LLM actions when present; otherwise keep rules. If both, union by kind+query.
  const mergedActions = (() => {
    if (actions.length === 0) return rulesResult.actions;
    if (rulesResult.actions.length === 0) return actions;
    const seen = new Set(
      actions.map(
        (a) =>
          `${a.kind}|${(a.targetQuery ?? a.title).toLowerCase()}|${a.navigateTo ?? ""}`,
      ),
    );
    const extras = rulesResult.actions.filter(
      (a) =>
        !seen.has(
          `${a.kind}|${(a.targetQuery ?? a.title).toLowerCase()}|${a.navigateTo ?? ""}`,
        ),
    );
    return [...actions, ...extras];
  })();

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

  return attachTargets(
    {
      items: mergedItems,
      actions: mergedActions,
      clarifications: [...rulesResult.clarifications, ...clarifications],
      source: "llm",
    },
    pendingItems,
  );
}

export async function parseBrainDump(
  text: string,
  options: ParseDumpOptions,
): Promise<ParseDumpResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { items: [], actions: [], clarifications: [], source: "rules" };
  }

  const refinedRules = refineRulesResult(
    trimmed,
    options.categories,
    options.items,
  );

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
      options.items ?? [],
    );
    return llmResult ?? refinedRules;
  } catch {
    return refinedRules;
  }
}
