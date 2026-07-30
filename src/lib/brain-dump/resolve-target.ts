import type { Item } from "../../types";

import type { ProposedFeatureAction } from "./types";

export interface TitleMatch {
  id: string;
  title: string;
  score: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length > 1),
  );
}

/** Score how well a query matches an item title (0–1). */
export function scoreTitleMatch(query: string, title: string): number {
  const q = normalize(query);
  const t = normalize(title);
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q) || q.includes(t)) {
    const shorter = Math.min(q.length, t.length);
    const longer = Math.max(q.length, t.length);
    return 0.72 + (shorter / longer) * 0.2;
  }

  const qt = tokenSet(q);
  const tt = tokenSet(t);
  if (qt.size === 0 || tt.size === 0) return 0;
  let overlap = 0;
  for (const token of qt) {
    if (tt.has(token)) overlap += 1;
  }
  const recall = overlap / qt.size;
  const precision = overlap / tt.size;
  if (overlap === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

export function findItemMatches(
  query: string,
  items: Item[],
  opts: {
    status?: Item["status"] | Item["status"][];
    type?: Item["type"];
    limit?: number;
  } = {},
): TitleMatch[] {
  const statuses = opts.status
    ? Array.isArray(opts.status)
      ? opts.status
      : [opts.status]
    : (["pending", "snoozed"] as Item["status"][]);

  const scored = items
    .filter((item) => {
      if (!statuses.includes(item.status)) return false;
      if (opts.type && item.type !== opts.type) return false;
      return true;
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      score: scoreTitleMatch(query, item.title),
    }))
    .filter((m) => m.score >= 0.45)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, opts.limit ?? 5);
}

/** Attach resolvedItemId / matchCandidates onto actions that need a target. */
export function resolveActionTargets(
  actions: ProposedFeatureAction[],
  items: Item[],
): ProposedFeatureAction[] {
  return actions.map((action) => {
    if (action.kind === "create_folder" || action.kind === "create_area") {
      return action;
    }
    if (
      action.kind === "park_open" ||
      action.kind === "export_data" ||
      action.kind === "update_settings" ||
      action.kind === "rename_area" ||
      action.kind === "delete_area" ||
      action.kind === "bump_nudges" ||
      action.kind === "complete_overdue" ||
      action.kind === "restore_backup" ||
      action.kind === "update_area"
    ) {
      return action;
    }

    // Area filter navigate — no item target
    if (
      action.kind === "navigate" &&
      action.categoryHint &&
      !action.targetQuery
    ) {
      return action;
    }

    if (!action.targetQuery?.trim()) {
      if (
        action.kind === "delete_folder" ||
        action.kind === "rename_folder" ||
        action.kind === "move_folder"
      ) {
        const matches = findItemMatches(action.title, items, {
          status: ["pending", "snoozed"],
          type: "project",
        });
        return attachMatches(action, matches);
      }
      return action;
    }

    const wantsFolder =
      action.kind === "delete_folder" ||
      action.kind === "rename_folder" ||
      action.kind === "move_folder" ||
      (action.kind === "navigate" &&
        (action.navigateTo === "/folders" ||
          action.summary.toLowerCase().includes("folder")));

    const statusFilter =
      action.kind === "unsnooze_item"
        ? ("snoozed" as const)
        : action.kind === "reopen_item"
          ? ("done" as const)
          : action.kind === "complete_item" ||
              action.kind === "delete_item" ||
              action.kind === "snooze_item" ||
              action.kind === "update_item" ||
              action.kind === "set_pipeline" ||
              action.kind === "navigate" ||
              action.kind === "delete_folder" ||
              action.kind === "rename_folder" ||
              action.kind === "move_folder" ||
              action.kind === "duplicate_item"
            ? (["pending", "snoozed"] as Item["status"][])
            : undefined;

    const typeFilter =
      action.kind === "set_pipeline"
        ? ("follow-up" as const)
        : wantsFolder
          ? ("project" as const)
          : undefined;

    const matches = findItemMatches(action.targetQuery, items, {
      status: statusFilter,
      type: typeFilter,
    });

    return attachMatches(action, matches, wantsFolder);
  });
}

function attachMatches(
  action: ProposedFeatureAction,
  matches: TitleMatch[],
  openAsFolder = false,
): ProposedFeatureAction {
  if (matches.length === 0) {
    return {
      ...action,
      resolvedItemId: undefined,
      matchCandidates: undefined,
      selected: false,
      summary: `${action.summary} — no match found`,
    };
  }

  const best = matches[0];
  const ambiguous = matches.length > 1 && matches[1].score > best.score - 0.08;

  if (action.kind === "navigate" && action.targetQuery) {
    const path = openAsFolder ? `/folders/${best.id}` : `/?item=${best.id}`;
    return {
      ...action,
      title: best.title,
      resolvedItemId: ambiguous ? undefined : best.id,
      matchCandidates: matches,
      selected: !ambiguous,
      navigateTo: ambiguous ? action.navigateTo : path,
      summary: ambiguous
        ? `${openAsFolder ? "Open folder" : "Open"} “${best.title}” — pick which one`
        : `${openAsFolder ? "Open folder" : "Open"} “${best.title}”`,
    };
  }

  return {
    ...action,
    title: best.title,
    resolvedItemId: ambiguous ? undefined : best.id,
    matchCandidates: matches,
    selected: !ambiguous,
    summary: ambiguous
      ? `${action.summary.replace(/“.+”/, `“${best.title}”`)} — pick which one`
      : action.summary.replace(/“.+”/, `“${best.title}”`),
  };
}
