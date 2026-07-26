import { addWeeks, parseISO } from "date-fns";
import type { Item, PipelineStage } from "../types";
import { PIPELINE_STAGE_LABELS } from "../types";
import { isOverdue } from "./dates";

export const GPD_WEEKS_BEFORE_EVENT = 10;
export const STALE_DAYS = 5;

export interface Suggestion {
  id: string;
  itemId: string;
  title: string;
  reason: string;
  urgency: "high" | "medium";
}

export function gpdDueFromEvent(eventIso: string): Date {
  return addWeeks(parseISO(eventIso), -GPD_WEEKS_BEFORE_EVENT);
}

export function isFollowUpActive(item: Item): boolean {
  return item.type === "follow-up" && item.status !== "done";
}

export function needsChase(item: Item, now = new Date()): boolean {
  if (!isFollowUpActive(item)) return false;

  if (item.checkBackAt && parseISO(item.checkBackAt) <= now) return true;

  if (item.pipelineStage === "deferred") return false;

  if (item.pipelineStage === "my_turn") {
    if (item.dueAt && isOverdue(item)) return true;
    if (daysSince(item.lastContactAt ?? item.createdAt, now) >= STALE_DAYS) {
      return true;
    }
  }

  if (
    item.pipelineStage === "waiting" ||
    item.pipelineStage === "scheduling" ||
    item.pipelineStage === "outreach"
  ) {
    const since = item.lastContactAt ?? item.createdAt;
    if (daysSince(since, now) >= STALE_DAYS) return true;
  }

  if (!item.pipelineStage && item.dueAt && isOverdue(item)) return true;

  return false;
}

export function chaseReason(item: Item, now = new Date()): string {
  if (item.checkBackAt && parseISO(item.checkBackAt) <= now) {
    return "Time to look back on this";
  }
  if (item.pipelineStage === "my_turn") {
    return item.nextAction?.trim() || "Your move on this thread";
  }
  if (item.pipelineStage === "scheduling") {
    return "Scheduling went quiet — follow up";
  }
  if (item.pipelineStage === "waiting" || item.pipelineStage === "outreach") {
    return "No reply in a while — send a bump";
  }
  if (item.dueAt && isOverdue(item)) return "Past due";
  return "Needs attention";
}

export function buildSuggestions(
  items: Item[],
  now = new Date(),
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const item of items) {
    if (!needsChase(item, now)) continue;
    const reason = chaseReason(item, now);
    out.push({
      id: `sug-${item.id}`,
      itemId: item.id,
      title: item.contactName
        ? `${item.contactName}: ${item.title}`
        : item.title,
      reason,
      urgency:
        item.pipelineStage === "my_turn" ||
        (item.checkBackAt && parseISO(item.checkBackAt) <= now)
          ? "high"
          : "medium",
    });
  }
  return out.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "high" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export function groupFollowUpsByStage(
  items: Item[],
): Map<PipelineStage | "unset", Item[]> {
  const order: (PipelineStage | "unset")[] = [
    "my_turn",
    "scheduling",
    "waiting",
    "outreach",
    "deferred",
    "unset",
  ];
  const map = new Map<PipelineStage | "unset", Item[]>();
  for (const key of order) map.set(key, []);

  for (const item of items.filter(isFollowUpActive)) {
    const key = item.pipelineStage ?? "unset";
    map.get(key)!.push(item);
  }

  return map;
}

export function stageLabel(stage?: PipelineStage): string {
  if (!stage) return "No stage";
  return PIPELINE_STAGE_LABELS[stage];
}

function daysSince(iso: string, now: Date): number {
  const ms = now.getTime() - parseISO(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

export function isStaleThread(item: Item, now = new Date()): boolean {
  if (!isFollowUpActive(item)) return false;
  if (item.pipelineStage === "deferred") return false;
  const since = item.lastContactAt ?? item.createdAt;
  return daysSince(since, now) >= STALE_DAYS;
}

export function filterStaleThreads(items: Item[]): Item[] {
  return items.filter((item) => isStaleThread(item));
}
