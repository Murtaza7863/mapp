import type { Item } from "../types";

import type { DailyBriefing } from "./briefing";
import { isDueToday, isOverdue } from "./dates";
import { generateAiInsight } from "./brain-dump/llm-engine";

const CACHE_PREFIX = "mapp-ai-brief-";

function cacheKey(briefing: DailyBriefing, topTitles: string[]): string {
  const day = new Date().toISOString().slice(0, 10);
  const sig = [
    briefing.overdue,
    briefing.dueToday,
    briefing.needsNudge,
    briefing.urgentPrep,
    ...topTitles.slice(0, 5),
  ].join("|");
  return `${CACHE_PREFIX}${day}:${sig}`;
}

function topPendingTitles(items: Item[], limit = 5): string[] {
  const pending = items.filter((i) => i.status === "pending");
  const scored = pending.map((item) => {
    let score = 0;
    if (isOverdue(item)) score += 3;
    if (isDueToday(item)) score += 2;
    if (item.priority) score += 1;
    if (item.type === "follow-up") score += 1;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item.title);
}

export interface AiBriefingResult {
  insight: string;
  source: "ai" | "rules";
}

export async function fetchAiBriefing(
  items: Item[],
  briefing: DailyBriefing,
  options: { preferAi?: boolean } = {},
): Promise<AiBriefingResult> {
  const titles = topPendingTitles(items);
  const fallback = buildRulesInsight(briefing, titles);

  if (options.preferAi === false) {
    return { insight: fallback, source: "rules" };
  }

  const key = cacheKey(briefing, titles);
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      return { insight: cached, source: "ai" };
    }
  } catch {
    /* private mode */
  }

  try {
    const insight = await generateAiInsight({
      briefing,
      topTasks: titles,
    });
    if (insight?.trim()) {
      try {
        sessionStorage.setItem(key, insight.trim());
      } catch {
        /* ignore */
      }
      return { insight: insight.trim(), source: "ai" };
    }
  } catch {
    /* fall through */
  }

  return { insight: fallback, source: "rules" };
}

function buildRulesInsight(
  briefing: DailyBriefing,
  topTasks: string[],
): string {
  if (
    briefing.needsNudge === 0 &&
    briefing.overdue === 0 &&
    briefing.dueToday === 0 &&
    briefing.urgentPrep === 0
  ) {
    return "You're clear. Add anything that comes up.";
  }

  const parts: string[] = [];
  if (briefing.overdue > 0) {
    parts.push(`clear ${briefing.overdue} overdue`);
  }
  if (briefing.needsNudge > 0) {
    parts.push(
      `nudge ${briefing.needsNudge} follow-up${briefing.needsNudge === 1 ? "" : "s"}`,
    );
  }
  if (briefing.dueToday > 0) {
    parts.push(`focus on ${briefing.dueToday} due today`);
  }
  if (briefing.urgentPrep > 0) {
    parts.push(
      `prep ${briefing.urgentPrep} event deadline${briefing.urgentPrep === 1 ? "" : "s"}`,
    );
  }

  const focus = topTasks[0];
  const tail = focus ? ` Start with “${focus}”.` : "";
  return `Prioritize: ${parts.join(", ")}.${tail}`;
}
