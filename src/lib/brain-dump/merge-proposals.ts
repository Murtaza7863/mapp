import type { ProposedItem } from "./types";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKey(item: ProposedItem): string {
  return `${normalizeTitle(item.title)}|${item.dueAt?.slice(0, 10) ?? ""}`;
}

function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const aWords = new Set(na.split(" "));
  const bWords = nb.split(" ").filter((w) => aWords.has(w));
  return (
    bWords.length >= Math.min(2, Math.min(aWords.size, nb.split(" ").length))
  );
}

function scoreItem(item: ProposedItem): number {
  let score = 0;
  if (item.dueAt) score += 2;
  if (item.contactName) score += 2;
  if (item.categoryId || item.categoryHint) score += 1;
  if (item.structure?.areaName) score += 2;
  if (item.type === "follow-up" && item.contactName) score += 1;
  return score;
}

function pickBetter(a: ProposedItem, b: ProposedItem): ProposedItem {
  const sa = scoreItem(a);
  const sb = scoreItem(b);
  if (sb > sa) return b;
  if (sa > sb) return a;
  return a.title.length >= b.title.length ? a : b;
}

/** Combine rules and LLM proposals — keep the best of both, deduped. */
export function mergePlotProposals(
  rules: ProposedItem[],
  llm: ProposedItem[],
): ProposedItem[] {
  if (llm.length === 0) return rules;
  if (rules.length === 0) return llm;

  const merged = new Map<string, ProposedItem>();

  for (const item of llm) {
    merged.set(dedupeKey(item), item);
  }

  for (const ruleItem of rules) {
    const key = dedupeKey(ruleItem);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, pickBetter(existing, ruleItem));
      continue;
    }

    let matchedKey: string | undefined;
    for (const [k, llmItem] of merged) {
      if (titlesSimilar(llmItem.title, ruleItem.title)) {
        matchedKey = k;
        merged.set(k, pickBetter(llmItem, ruleItem));
        break;
      }
    }

    if (!matchedKey) {
      merged.set(key, ruleItem);
    }
  }

  return [...merged.values()];
}
