import { v4 as uuidv4 } from "uuid";

import type { Category, PipelineStage } from "../../types";

import { parseQuickAdd } from "../quickadd";
import { normalizePlotLine } from "./ramble";
import type {
  AppFeatureId,
  ProposedFeatureAction,
  ProposedItemPatch,
} from "./types";

function resolveCategoryId(
  hint: string | undefined,
  categories: Category[],
): string | undefined {
  if (!hint?.trim()) return undefined;
  const q = hint.trim().toLowerCase();
  const exact = categories.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact.id;
  return categories.find((c) => c.name.toLowerCase().startsWith(q))?.id;
}

export interface AppFeature {
  id: AppFeatureId;
  label: string;
  description: string;
}

export const APP_FEATURES: AppFeature[] = [
  {
    id: "create_folder",
    label: "Create folder",
    description: "create folder for X",
  },
  {
    id: "create_area",
    label: "Create area",
    description: "create area called X",
  },
  {
    id: "complete_item",
    label: "Complete",
    description: "done: X | mark X done",
  },
  { id: "snooze_item", label: "Snooze", description: "snooze X until DATE" },
  { id: "unsnooze_item", label: "Wake", description: "unsnooze X | wake X" },
  { id: "delete_item", label: "Delete", description: "delete X | remove X" },
  {
    id: "update_item",
    label: "Update",
    description:
      "move/file/reschedule/rename/star/note/mute/remind/next action/check-back/clear date/retype/schedule",
  },
  {
    id: "set_pipeline",
    label: "Follow-up stage",
    description: "mark X waiting | your turn on X | stage: waiting on X",
  },
  {
    id: "navigate",
    label: "Go to",
    description:
      "open calendar | show nudges | find X | open folder X | show area X",
  },
  {
    id: "reopen_item",
    label: "Reopen",
    description: "reopen X | uncomplete X",
  },
  {
    id: "rename_area",
    label: "Rename area",
    description: "rename area A to B",
  },
  { id: "delete_area", label: "Delete area", description: "delete area X" },
  {
    id: "delete_folder",
    label: "Delete folder",
    description: "delete folder X",
  },
  { id: "park_open", label: "Park open", description: "park open tasks" },
  {
    id: "export_data",
    label: "Export",
    description: "export backup | export area X",
  },
  {
    id: "update_settings",
    label: "Settings",
    description:
      "turn on digest | digest at 8am | default area X | week starts monday",
  },
  {
    id: "rename_folder",
    label: "Rename folder",
    description: "rename folder A to B",
  },
  { id: "bump_nudges", label: "Bump nudges", description: "bump all nudges" },
  {
    id: "complete_overdue",
    label: "Complete overdue",
    description: "complete all overdue",
  },
  { id: "duplicate_item", label: "Duplicate", description: "duplicate X" },
  {
    id: "move_folder",
    label: "Move folder",
    description: "move folder X to AREA",
  },
  {
    id: "update_area",
    label: "Update area",
    description: "recolor area X blue | set subgroups on X to A, B",
  },
  {
    id: "restore_backup",
    label: "Restore backup",
    description: "restore auto-backup",
  },
];

const WORKSPACE_TAIL = /(?:\s+(?:workspace|area|space))?$/i;

function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(WORKSPACE_TAIL, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeName(name: string): string {
  if (!name) return name;
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveAreaHint(
  hint: string | undefined,
  categories: Category[],
): { categoryId?: string; categoryHint?: string } {
  if (!hint?.trim()) return {};
  const cleaned = cleanName(hint);
  const categoryId = resolveCategoryId(cleaned, categories);
  return { categoryId, categoryHint: cleaned };
}

const AREA_COLOR_NAMES: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  orange: "#f59e0b",
  gold: "#f59e0b",
  purple: "#8b5cf6",
  violet: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
  red: "#ef4444",
  indigo: "#6366f1",
  slate: "#64748b",
  gray: "#64748b",
  grey: "#64748b",
};

function resolveAreaColor(raw: string): string | undefined {
  const q = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/i.test(q)) return q;
  return AREA_COLOR_NAMES[q];
}

export interface MatchedFeature {
  featureId: AppFeatureId;
  title: string;
  categoryHint?: string;
  categoryId?: string;
  summary: string;
  targetQuery?: string;
  dueAt?: string;
  patch?: ProposedItemPatch;
  settingsPatch?: import("./types").ProposedSettingsPatch;
  areaPatch?: import("./types").ProposedAreaPatch;
  navigateTo?: string;
  openSheet?: "wrapup" | "triage";
  pipelineStage?: PipelineStage;
}

function folderAction(
  titleRaw: string,
  categoryHint?: string,
): MatchedFeature | null {
  const title = capitalizeName(cleanName(titleRaw));
  if (title.length < 1 || title.length >= 60) return null;
  if (/^(?:a|an|the|in|under|inside|for|named|called)$/i.test(title)) {
    return null;
  }
  const area = categoryHint ? capitalizeName(cleanName(categoryHint)) : "";
  return {
    featureId: "create_folder",
    title,
    categoryHint: categoryHint ? cleanName(categoryHint) : undefined,
    summary: area
      ? `New folder “${title}” in ${area}`
      : `New folder “${title}”`,
  };
}

function areaAction(titleRaw: string): MatchedFeature | null {
  const title = capitalizeName(cleanName(titleRaw));
  if (title.length < 1 || title.length >= 40) return null;
  if (/^(?:a|an|the)$/i.test(title)) return null;
  return {
    featureId: "create_area",
    title,
    summary: `New area “${title}”`,
  };
}

function parseUntilDate(
  datePhrase: string,
  categories: Category[],
  now: Date,
): string | undefined {
  const parsed = parseQuickAdd(
    `reminder ${datePhrase.trim()}`,
    categories,
    now,
  );
  return parsed.dueAt;
}

function targetAction(
  featureId: AppFeatureId,
  queryRaw: string,
  summaryVerb: string,
  extra: Partial<MatchedFeature> = {},
): MatchedFeature | null {
  const query = cleanName(queryRaw)
    .replace(/^(?:the|my|a|an)\s+/i, "")
    .trim();
  if (query.length < 2 || query.length > 80) return null;
  if (/^(?:it|this|that|them|all)$/i.test(query)) return null;
  const label = capitalizeName(query);
  return {
    featureId,
    title: label,
    targetQuery: query,
    summary: `${summaryVerb} “${label}”`,
    ...extra,
  };
}

type NavEntry = {
  to: string;
  label: string;
  openSheet?: "wrapup" | "triage";
};

/** Exact screen/filter phrases — O(1) lookup instead of scanning regexes. */
const NAV_EXACT = new Map<string, NavEntry>(
  (
    [
      ["open calendar", "/calendar", "Calendar"],
      ["show calendar", "/calendar", "Calendar"],
      ["go to calendar", "/calendar", "Calendar"],
      ["goto calendar", "/calendar", "Calendar"],
      ["open calendars", "/calendar", "Calendar"],
      ["show calendars", "/calendar", "Calendar"],
      ["open area", "/categories", "Areas"],
      ["open areas", "/categories", "Areas"],
      ["show areas", "/categories", "Areas"],
      ["go to areas", "/categories", "Areas"],
      ["open follow-ups", "/follow-ups", "Follow-ups"],
      ["open follow ups", "/follow-ups", "Follow-ups"],
      ["show follow-ups", "/follow-ups", "Follow-ups"],
      ["open threads", "/follow-ups", "Follow-ups"],
      ["show threads", "/follow-ups", "Follow-ups"],
      ["go to follow-ups", "/follow-ups", "Follow-ups"],
      ["open settings", "/settings", "Settings"],
      ["show settings", "/settings", "Settings"],
      ["go to settings", "/settings", "Settings"],
      ["open notes", "/notes", "Notes"],
      ["show notes", "/notes", "Notes"],
      ["go to notes", "/notes", "Notes"],
      ["open history", "/history", "History"],
      ["show history", "/history", "History"],
      ["go to history", "/history", "History"],
      ["open search", "/search", "Search"],
      ["show search", "/search", "Search"],
      ["go to search", "/search", "Search"],
      ["open folders", "/folders", "Folders"],
      ["show folders", "/folders", "Folders"],
      ["go to folders", "/folders", "Folders"],
      ["open insights", "/insights", "Insights"],
      ["show insights", "/insights", "Insights"],
      ["go to insights", "/insights", "Insights"],
      ["open home", "/", "Home"],
      ["show home", "/", "Home"],
      ["go to home", "/", "Home"],
      ["open today", "/", "Home"],
      ["show today", "/", "Home"],
      ["go to today", "/", "Home"],
      ["open guide", "/guide", "How to use"],
      ["show guide", "/guide", "How to use"],
      ["go to guide", "/guide", "How to use"],
      ["open how it works", "/guide", "How to use"],
      ["show how it works", "/guide", "How to use"],
      ["open how to use", "/guide", "How to use"],
      ["show how to use", "/guide", "How to use"],
      ["open event prep", "/deadlines", "Event prep"],
      ["open prep", "/deadlines", "Event prep"],
      ["show prep", "/deadlines", "Event prep"],
      ["go to prep", "/deadlines", "Event prep"],
      ["show nudges", "/?focus=chase", "Nudges"],
      ["open nudges", "/?focus=chase", "Nudges"],
      ["work nudges", "/?focus=chase", "Nudges"],
      ["show overdue", "/?focus=overdue", "Overdue"],
      ["open overdue", "/?focus=overdue", "Overdue"],
      ["show priority", "/?focus=priority", "Priority"],
      ["open priority", "/?focus=priority", "Priority"],
      ["show today due", "/?focus=today", "Due today"],
      ["show due today", "/?focus=today", "Due today"],
      ["open due today", "/?focus=today", "Due today"],
      ["show routines", "/?focus=routine", "Routines"],
      ["open routines", "/?focus=routine", "Routines"],
      ["show snoozed", "/?focus=snoozed", "Snoozed"],
      ["open snoozed", "/?focus=snoozed", "Snoozed"],
    ] as Array<[string, string, string]>
  ).map(([k, to, label]) => [k, { to, label }]),
);

NAV_EXACT.set("wrap up", { to: "/", label: "Wrap up", openSheet: "wrapup" });
NAV_EXACT.set("wrap up day", {
  to: "/",
  label: "Wrap up",
  openSheet: "wrapup",
});
NAV_EXACT.set("open wrap-up", {
  to: "/",
  label: "Wrap up",
  openSheet: "wrapup",
});
NAV_EXACT.set("open wrap up", {
  to: "/",
  label: "Wrap up",
  openSheet: "wrapup",
});
NAV_EXACT.set("triage", { to: "/", label: "Triage", openSheet: "triage" });
NAV_EXACT.set("set dates", { to: "/", label: "Triage", openSheet: "triage" });
NAV_EXACT.set("open triage", { to: "/", label: "Triage", openSheet: "triage" });

const NAV_SCREEN_WORDS =
  /^(?:calendar|areas?|follow[- ]?ups?|threads?|settings?|notes?|history|search|folders?|insights?|home|today|guide|how it works|event prep|prep|nudges?|overdue|priority|wrap|triage|folder)\b/i;

function matchNavigate(text: string): MatchedFeature | null {
  const key = text.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = NAV_EXACT.get(key);
  if (exact) {
    return {
      featureId: "navigate",
      title: exact.label,
      summary: `Go to ${exact.label}`,
      navigateTo: exact.to,
      openSheet: exact.openSheet,
    };
  }

  const find = text.match(/^(?:find|search(?:\s+for)?|look\s+up)\s+(.+)$/i);
  if (find) {
    const q = cleanName(find[1]);
    if (q.length >= 2) {
      return {
        featureId: "navigate",
        title: capitalizeName(q),
        summary: `Search “${capitalizeName(q)}”`,
        navigateTo: `/search?q=${encodeURIComponent(q)}`,
      };
    }
  }

  const openFolder = text.match(
    /^(?:open|show|go to|goto)\s+(?:the\s+)?(?:folder\s+(.+)|(.+?)\s+folder)$/i,
  );
  if (openFolder) {
    const q = cleanName(openFolder[1] || openFolder[2] || "");
    if (q.length >= 2) {
      return {
        featureId: "navigate",
        title: capitalizeName(q),
        summary: `Open folder “${capitalizeName(q)}”`,
        targetQuery: q,
        navigateTo: "/folders",
      };
    }
  }

  const showArea = text.match(/^(?:show|open|filter)\s+area\s+(.+)$/i);
  if (showArea) {
    const q = cleanName(showArea[1]);
    return {
      featureId: "navigate",
      title: capitalizeName(q),
      summary: `Filter area “${capitalizeName(q)}”`,
      categoryHint: q,
      navigateTo: "/",
    };
  }

  const openItem = text.match(/^(?:open|show)\s+(.+)$/i);
  if (openItem && !NAV_SCREEN_WORDS.test(openItem[1])) {
    const q = cleanName(openItem[1]);
    if (q.length >= 2) {
      return {
        featureId: "navigate",
        title: capitalizeName(q),
        summary: `Open “${capitalizeName(q)}”`,
        targetQuery: q,
        navigateTo: "/",
      };
    }
  }

  return null;
}

function tryItemPatch(
  text: string,
  re: RegExp,
  verb: string,
  patch: ProposedItemPatch | undefined,
  extra: Partial<MatchedFeature> & { kind?: AppFeatureId; q?: number } = {},
): MatchedFeature | null {
  const m = text.match(re);
  if (!m) return null;
  const { kind, q = 1, ...rest } = extra;
  return targetAction(kind ?? "update_item", m[q], verb, {
    ...(patch ? { patch } : {}),
    ...rest,
  });
}

function clearFieldOn(
  text: string,
  re: RegExp,
  verb: string,
  patch: ProposedItemPatch,
  extra: Partial<MatchedFeature> = {},
): MatchedFeature | null {
  const m = text.match(re);
  if (!m) return null;
  const label = capitalizeName(cleanName(m[1]));
  return targetAction("update_item", m[1], verb, {
    patch,
    summary: `${verb} on “${label}”`,
    ...extra,
  });
}

/** Field/patch intents — first-word gate avoids scanning ~30 regexes per line. */
function matchItemPatchRules(
  text: string,
  categories: Category[],
  now: Date,
): MatchedFeature | null {
  const head = text.match(/^[a-zA-Z]+/)?.[0]?.toLowerCase() ?? "";

  if (
    head === "star" ||
    head === "prioritize" ||
    head === "pin" ||
    (head === "make" && /^make\s+priority\b/i.test(text))
  ) {
    return tryItemPatch(
      text,
      /^(?:star|prioritize|pin|make\s+priority)\s+(.+)$/i,
      "Star",
      { priority: true },
    );
  }

  if (
    head === "unstar" ||
    head === "unpin" ||
    (head === "clear" && /priority/i.test(text)) ||
    (head === "remove" && /priority/i.test(text))
  ) {
    return tryItemPatch(
      text,
      /^(?:unstar|unpin|clear\s+priority|remove\s+priority)\s+(.+)$/i,
      "Unstar",
      { priority: false },
    );
  }

  if (head === "note" || (head === "add" && /^add\s+note\b/i.test(text))) {
    const m = text.match(
      /^(?:note(?:\s+on)?|add note(?:\s+to)?)\s+(.+?)\s*[:\-–—]\s*(.+)$/i,
    );
    if (m) {
      return tryItemPatch(
        text,
        /^(?:note(?:\s+on)?|add note(?:\s+to)?)\s+(.+?)\s*[:\-–—]\s*(.+)$/i,
        "Note",
        { notes: m[2].trim() },
        {
          summary: `Note on “${capitalizeName(cleanName(m[1]))}”`,
        },
      );
    }
  }

  if (head === "make" || head === "turn" || head === "convert") {
    const m = text.match(
      /^(?:make|turn|convert)\s+(.+?)\s+(?:(?:into|to|as)\s+)?(?:a\s+)?(follow[- ]?up|deadline|routine|note|project)$/i,
    );
    if (m) {
      const typeRaw = m[2].toLowerCase().replace(/\s+/g, "-");
      const type =
        typeRaw === "followup" || typeRaw === "follow-up"
          ? ("follow-up" as const)
          : (typeRaw as "deadline" | "routine" | "note" | "project");
      return targetAction("update_item", m[1], "Retype", {
        patch: {
          type,
          ...(type === "routine"
            ? { recurrence: { frequency: "daily" as const } }
            : {}),
        },
        summary: `Make “${capitalizeName(cleanName(m[1]))}” a ${type}`,
      });
    }
  }

  if (head === "set" || head === "make") {
    const m = text.match(
      /^(?:set|make)\s+(.+?)\s+(?:to\s+)?(every\s+day|daily|weekdays|every\s+weekday|weekly|every\s+week)$/i,
    );
    if (m) {
      const freqRaw = m[2].toLowerCase();
      const frequency = /weekday/.test(freqRaw)
        ? ("weekdays" as const)
        : /week/.test(freqRaw)
          ? ("weekly" as const)
          : ("daily" as const);
      return targetAction("update_item", m[1], "Schedule", {
        patch: { type: "routine", recurrence: { frequency } },
        summary: `Set “${capitalizeName(cleanName(m[1]))}” ${frequency}`,
      });
    }
  }

  if (head === "reopen" || head === "uncomplete" || head === "restore") {
    return tryItemPatch(
      text,
      /^(?:reopen|uncomplete|restore)\s+(.+)$/i,
      "Reopen",
      undefined,
      { kind: "reopen_item" },
    );
  }

  if (head === "file" || head === "move") {
    const m = text.match(
      /^(?:file|move)\s+(.+?)\s+(?:in|into|under)\s+(?:the\s+)?(.+?)\s+folder$/i,
    );
    if (m) {
      const folder = capitalizeName(cleanName(m[2]));
      return targetAction("update_item", m[1], "File", {
        patch: { parentFolderName: folder },
        summary: `File “${capitalizeName(cleanName(m[1]))}” under ${folder}`,
      });
    }
  }

  if (head === "unfile" || (head === "remove" && /folder/i.test(text))) {
    return tryItemPatch(
      text,
      /^(?:unfile|remove from folder)\s+(.+)$/i,
      "Unfile",
      { parentFolderName: null },
    );
  }

  if (
    head === "link" ||
    head === "event" ||
    (head === "set" && /^set\s+event\b/i.test(text))
  ) {
    const m = text.match(
      /^(?:link event(?:\s+on)?|event date(?:\s+for)?|set event(?:\s+on)?)\s+(.+?)\s+(?:to|for|:|on)\s+(.+)$/i,
    );
    if (m) {
      const dueAt = parseUntilDate(m[2], categories, now);
      return targetAction("update_item", m[1], "Link event", {
        dueAt,
        patch: { linkedEventAt: dueAt ?? null },
        summary: `Link event on “${capitalizeName(cleanName(m[1]))}”`,
      });
    }
  }

  if (head === "set" && /subgroup/i.test(text) && !/subgroups/i.test(text)) {
    const m = text.match(
      /^(?:set subgroup(?:\s+on)?|move(?:\s+to)? subgroup|file(?:\s+under)? subgroup)\s+(.+?)\s+(?:to|as|under|:)\s+(.+)$/i,
    );
    if (m) {
      const group = capitalizeName(cleanName(m[2]));
      return targetAction("update_item", m[1], "Subgroup", {
        patch: { childGroup: group },
        summary: `Subgroup “${capitalizeName(cleanName(m[1]))}” → ${group}`,
      });
    }
  }

  if (head === "move" || head === "file") {
    const m = text.match(
      /^(?:set subgroup(?:\s+on)?|move(?:\s+to)? subgroup|file(?:\s+under)? subgroup)\s+(.+?)\s+(?:to|as|under|:)\s+(.+)$/i,
    );
    if (m) {
      const group = capitalizeName(cleanName(m[2]));
      return targetAction("update_item", m[1], "Subgroup", {
        patch: { childGroup: group },
        summary: `Subgroup “${capitalizeName(cleanName(m[1]))}” → ${group}`,
      });
    }
  }

  if (head === "last" || head === "contacted" || head === "touched") {
    const today = text.match(/^(?:contacted|touched)\s+(.+?)\s+today$/i);
    if (today) {
      return targetAction("update_item", today[1], "Last contact", {
        patch: { lastContactAt: new Date(now).toISOString() },
        summary: `Last contact on “${capitalizeName(cleanName(today[1]))}”`,
      });
    }
    const m = text.match(
      /^(?:last contact(?:\s+on)?|contacted|touched)\s+(.+?)\s+(?:on|at|:)\s*(.+)$/i,
    );
    if (m) {
      const whenRaw = m[2].trim();
      const dueAt = /^(?:today|now)$/i.test(whenRaw)
        ? new Date(now).toISOString()
        : parseUntilDate(whenRaw, categories, now);
      if (dueAt) {
        return targetAction("update_item", m[1], "Last contact", {
          patch: { lastContactAt: dueAt },
          summary: `Last contact on “${capitalizeName(cleanName(m[1]))}”`,
        });
      }
    }
  }

  if (head === "goal" || (head === "set" && /^set\s+goal\b/i.test(text))) {
    const m = text.match(
      /^(?:goal(?:\s+on)?|set goal(?:\s+on)?)\s+(.+?)\s*(?::|to|=)\s*(\d+)$/i,
    );
    if (m) {
      return targetAction("update_item", m[1], "Goal", {
        patch: { goalCount: Number(m[2]) },
        summary: `Goal on “${capitalizeName(cleanName(m[1]))}” → ${m[2]}`,
      });
    }
  }

  if (head === "duplicate" || head === "copy" || head === "clone") {
    return tryItemPatch(
      text,
      /^(?:duplicate|copy|clone)\s+(.+)$/i,
      "Duplicate",
      undefined,
      { kind: "duplicate_item" },
    );
  }

  if (head === "next") {
    const m = text.match(
      /^(?:next action(?:\s+on)?)\s+(.+?)\s*[:\-–—]\s*(.+)$/i,
    );
    if (m) {
      return targetAction("update_item", m[1], "Next action", {
        patch: { nextAction: m[2].trim() },
        summary: `Next action on “${capitalizeName(cleanName(m[1]))}”`,
      });
    }
  }

  if (head === "contact") {
    const m = text.match(/^(?:contact(?:\s+on)?)\s+(.+?)\s*[:\-–—]\s*(.+)$/i);
    if (m) {
      return targetAction("update_item", m[1], "Contact", {
        patch: { contactName: capitalizeName(cleanName(m[2])) },
        summary: `Contact on “${capitalizeName(cleanName(m[1]))}”`,
      });
    }
  }

  if (head === "check") {
    const m = text.match(
      /^(?:check back(?:\s+on)?)\s+(.+?)\s+(?:on|by|until|till)?\s*(.+)$/i,
    );
    if (m) {
      const dueAt = parseUntilDate(m[2], categories, now);
      return targetAction("update_item", m[1], "Check back", {
        dueAt,
        patch: { checkBackAt: dueAt ?? null },
        summary: `Check back on “${capitalizeName(cleanName(m[1]))}”`,
      });
    }
  }

  if (head === "mute") {
    return tryItemPatch(
      text,
      /^(?:mute(?:\s+notifications)?(?:\s+on)?)\s+(.+)$/i,
      "Mute",
      { notificationsMuted: true },
    );
  }

  if (head === "unmute") {
    return tryItemPatch(
      text,
      /^(?:unmute(?:\s+notifications)?(?:\s+on)?)\s+(.+)$/i,
      "Unmute",
      { notificationsMuted: false },
    );
  }

  if (head === "remind") {
    const m = text.match(
      /^(?:remind(?:\s+me)?)\s+(\d+)\s*(min(?:ute)?s?|m|hours?|h|days?|d)\s+before\s+(.+)$/i,
    );
    if (m) {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      const mins = /^(?:h|hours?)$/.test(unit)
        ? n * 60
        : /^(?:d|days?)$/.test(unit)
          ? n * 60 * 24
          : n;
      const label =
        mins >= 1440
          ? `${Math.round(mins / 1440)}d`
          : mins >= 60
            ? `${Math.round(mins / 60)}h`
            : `${mins}m`;
      return targetAction("update_item", m[3], "Reminder", {
        patch: { reminderOffsetMinutes: mins },
        summary: `Remind ${label} before “${capitalizeName(cleanName(m[3]))}”`,
      });
    }
  }

  if (
    head === "clear" ||
    head === "undate" ||
    head === "remove" ||
    head === "unlink"
  ) {
    return (
      clearFieldOn(
        text,
        /^(?:clear(?:\s+the)?\s+date(?:\s+on)?|undate|remove(?:\s+the)?\s+date(?:\s+on)?)\s+(.+)$/i,
        "Clear date",
        { dueAt: null },
        { dueAt: undefined },
      ) ??
      clearFieldOn(
        text,
        /^(?:clear event(?:\s+on)?|unlink event(?:\s+on)?)\s+(.+)$/i,
        "Clear event",
        { linkedEventAt: null },
      ) ??
      clearFieldOn(
        text,
        /^(?:clear subgroup(?:\s+on)?|remove subgroup(?:\s+on)?)\s+(.+)$/i,
        "Clear subgroup",
        { childGroup: null },
      ) ??
      clearFieldOn(
        text,
        /^(?:clear notes?(?:\s+on)?|remove notes?(?:\s+on)?)\s+(.+)$/i,
        "Clear notes",
        { notes: "" },
      ) ??
      clearFieldOn(
        text,
        /^(?:clear reminder(?:\s+on)?|remove reminder(?:\s+on)?)\s+(.+)$/i,
        "Clear reminder",
        { reminderOffsetMinutes: null },
      ) ??
      clearFieldOn(
        text,
        /^(?:clear next action(?:\s+on)?)\s+(.+)$/i,
        "Clear next action",
        { nextAction: null },
      ) ??
      clearFieldOn(
        text,
        /^(?:clear contact(?:\s+on)?)\s+(.+)$/i,
        "Clear contact",
        { contactName: null },
      ) ??
      clearFieldOn(
        text,
        /^(?:clear check[- ]?back(?:\s+on)?)\s+(.+)$/i,
        "Clear check-back",
        { checkBackAt: null },
      ) ??
      clearFieldOn(text, /^(?:clear goal(?:\s+on)?)\s+(.+)$/i, "Clear goal", {
        goalCount: null,
      })
    );
  }

  return null;
}

function matchItemCommands(
  text: string,
  categories: Category[],
  now: Date,
): MatchedFeature | null {
  // Prefer explicit control phrasing so we don't steal task creation
  // ("finish homework by thursday", "bump recruiter", "waiting on legal").
  const doneColon = text.match(
    /^(?:done|complete|finish|check off)\s*[:\-–—]\s*(.+)$/i,
  );
  if (doneColon) return targetAction("complete_item", doneColon[1], "Complete");

  const markDone = text.match(
    /^(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:done|complete|finished|completed)$/i,
  );
  if (markDone) return targetAction("complete_item", markDone[1], "Complete");

  const snoozeUntil = text.match(
    /^(?:snooze|park|postpone|delay)\s+(.+?)\s+(?:until|till|to)\s+(.+)$/i,
  );
  if (snoozeUntil) {
    const dueAt = parseUntilDate(snoozeUntil[2], categories, now);
    const label = capitalizeName(cleanName(snoozeUntil[1]));
    return targetAction("snooze_item", snoozeUntil[1], "Snooze", {
      dueAt,
      summary: dueAt ? `Snooze “${label}” until then` : `Snooze “${label}”`,
    });
  }

  const snoozeBare = text.match(/^(?:snooze|park)\s+(.+)$/i);
  if (snoozeBare) {
    const dueAt = parseUntilDate("tomorrow 9am", categories, now);
    return targetAction("snooze_item", snoozeBare[1], "Snooze", { dueAt });
  }

  const unsnooze = text.match(/^(?:unsnooze|wake(?:\s+up)?|unpark)\s+(.+)$/i);
  if (unsnooze) return targetAction("unsnooze_item", unsnooze[1], "Wake");

  const delArea = text.match(
    /^(?:delete|remove|trash)\s+(?:the\s+)?(?:area|workspace)\s+(.+)$/i,
  );
  if (delArea) {
    const title = capitalizeName(cleanName(delArea[1]));
    return {
      featureId: "delete_area",
      title,
      categoryHint: cleanName(delArea[1]),
      summary: `Delete area “${title}”`,
    };
  }

  const delFolder = text.match(
    /^(?:delete|remove|trash)\s+(?:the\s+)?folder\s+(.+)$/i,
  );
  if (delFolder) {
    const title = capitalizeName(cleanName(delFolder[1]));
    return {
      featureId: "delete_folder",
      title,
      targetQuery: cleanName(delFolder[1]),
      summary: `Delete folder “${title}”`,
    };
  }

  const del = text.match(/^(?:delete|remove|trash)\s+(?:the\s+)?(.+)$/i);
  if (del && !/^(?:area|folder|workspace)\b/i.test(del[1])) {
    return targetAction("delete_item", del[1], "Delete");
  }

  const moveFolder = text.match(
    /^(?:move|put)\s+folder\s+(.+?)\s+(?:to|into|under)\s+(?:#)?(.+)$/i,
  );
  if (moveFolder) {
    const folder = capitalizeName(cleanName(moveFolder[1]));
    const area = resolveAreaHint(moveFolder[2], categories);
    return {
      featureId: "move_folder",
      title: folder,
      targetQuery: cleanName(moveFolder[1]),
      categoryHint: area.categoryHint,
      categoryId: area.categoryId,
      summary: `Move folder “${folder}” to ${capitalizeName(cleanName(moveFolder[2]))}`,
      patch: {
        categoryId: area.categoryId,
        categoryHint: area.categoryHint,
      },
    };
  }

  const move = text.match(/^(?:move)\s+(.+?)\s+(?:to|into)\s+(?:#)?(.+)$/i);
  if (move && !/^folder\b/i.test(move[1])) {
    const destRaw = move[2].trim();
    const dest = cleanName(destRaw.replace(/\s+folder$/i, ""));
    const area = resolveAreaHint(dest, categories);
    const label = capitalizeName(cleanName(move[1]));
    const destLabel = capitalizeName(dest);
    const explicitArea = destRaw.startsWith("#") || Boolean(area.categoryId);
    if (explicitArea) {
      return targetAction("update_item", move[1], "Move", {
        categoryHint: area.categoryHint,
        patch: {
          categoryHint: area.categoryHint,
          categoryId: area.categoryId,
        },
        summary: `Move “${label}” to ${destLabel}`,
      });
    }
    return targetAction("update_item", move[1], "File", {
      patch: { parentFolderName: destLabel },
      summary: `File “${label}” under ${destLabel}`,
    });
  }

  const reschedule = text.match(
    /^(?:reschedule|push|defer)\s+(.+?)\s+(?:to|for|until|till)\s+(.+)$/i,
  );
  if (reschedule) {
    const dueAt = parseUntilDate(reschedule[2], categories, now);
    return targetAction("update_item", reschedule[1], "Reschedule", {
      dueAt,
      patch: { dueAt: dueAt ?? null },
      summary: `Reschedule “${capitalizeName(cleanName(reschedule[1]))}”`,
    });
  }

  const renameArea = text.match(
    /^(?:rename)\s+(?:area|workspace)\s+(.+?)\s+(?:to|as)\s+(.+)$/i,
  );
  if (renameArea) {
    const from = capitalizeName(cleanName(renameArea[1]));
    const to = capitalizeName(cleanName(renameArea[2]));
    return {
      featureId: "rename_area",
      title: to,
      categoryHint: cleanName(renameArea[1]),
      summary: `Rename area “${from}” → “${to}”`,
    };
  }

  const renameFolder = text.match(
    /^(?:rename|retitle)\s+folder\s+(.+?)\s+(?:to|as)\s+(.+)$/i,
  );
  if (renameFolder) {
    const from = capitalizeName(cleanName(renameFolder[1]));
    const to = capitalizeName(cleanName(renameFolder[2]));
    return {
      featureId: "rename_folder",
      title: to,
      targetQuery: cleanName(renameFolder[1]),
      summary: `Rename folder “${from}” → “${to}”`,
      patch: { title: to },
    };
  }

  const recolorArea = text.match(
    /^(?:recolor|recolour|color|colour)\s+(?:area|workspace)\s+(.+?)\s+(?:to\s+)?(.+)$/i,
  );
  if (recolorArea) {
    const color = resolveAreaColor(recolorArea[2]);
    if (color) {
      const name = capitalizeName(cleanName(recolorArea[1]));
      return {
        featureId: "update_area",
        title: name,
        categoryHint: cleanName(recolorArea[1]),
        summary: `Recolor area “${name}”`,
        areaPatch: { color },
      };
    }
  }

  const setSubgroups = text.match(
    /^(?:set\s+subgroups(?:\s+on)?|subgroups(?:\s+on)?)\s+(.+?)\s+(?:to|as|:)\s+(.+)$/i,
  );
  if (setSubgroups) {
    const name = capitalizeName(cleanName(setSubgroups[1]));
    const groups = setSubgroups[2]
      .split(/[,/|]/)
      .map((g) => capitalizeName(cleanName(g)))
      .filter(Boolean);
    if (groups.length > 0) {
      return {
        featureId: "update_area",
        title: name,
        categoryHint: cleanName(setSubgroups[1]),
        summary: `Subgroups on “${name}” → ${groups.join(", ")}`,
        areaPatch: { subgroups: groups },
      };
    }
  }

  const rename = text.match(/^(?:rename|retitle)\s+(.+?)\s+(?:to|as)\s+(.+)$/i);
  if (rename) {
    const newTitle = capitalizeName(cleanName(rename[2]));
    return targetAction("update_item", rename[1], "Rename", {
      patch: { title: newTitle },
      summary: `Rename to “${newTitle}”`,
    });
  }

  // Compact patch/field rules (same behavior, less branching overhead).
  const patched = matchItemPatchRules(text, categories, now);
  if (patched) return patched;

  const setWeekdays = text.match(/^(?:set|make)\s+(.+?)\s+(?:to\s+)?(.+)$/i);
  if (setWeekdays) {
    const dayMap: Record<string, number> = {
      mon: 1,
      monday: 1,
      tue: 2,
      tues: 2,
      tuesday: 2,
      wed: 3,
      weds: 3,
      wednesday: 3,
      thu: 4,
      thurs: 4,
      thursday: 4,
      fri: 5,
      friday: 5,
      sat: 6,
      saturday: 6,
      sun: 0,
      sunday: 0,
    };
    const tail = setWeekdays[2]
      .toLowerCase()
      .replace(/^every\s+/, "")
      .trim();
    if (
      !/^(?:every\s+day|daily|weekdays|every\s+weekday|weekly|every\s+week)$/i.test(
        setWeekdays[2],
      )
    ) {
      const tokens = tail.split(/[\s,/&]+/).filter((t) => t && t !== "and");
      const days: number[] = [];
      let allDays = tokens.length >= 2;
      for (const token of tokens) {
        const d = dayMap[token];
        if (d === undefined) {
          allDays = false;
          break;
        }
        if (!days.includes(d)) days.push(d);
      }
      if (allDays && days.length >= 2) {
        return targetAction("update_item", setWeekdays[1], "Schedule", {
          patch: {
            type: "routine",
            recurrence: { frequency: "custom", daysOfWeek: days },
          },
          summary: `Set “${capitalizeName(cleanName(setWeekdays[1]))}” custom days`,
        });
      }
    }
  }

  // Pipeline stage — explicit only (bare "bump X" / "waiting on X" still create follow-ups)
  const bumpStage = text.match(
    /^(?:bump(?:\s+stage)?|mark|set)\s+(.+?)\s+(?:as\s+)?waiting$/i,
  );
  if (bumpStage) {
    return targetAction("set_pipeline", bumpStage[1], "Waiting", {
      pipelineStage: "waiting",
      summary: `Bump “${capitalizeName(cleanName(bumpStage[1]))}” (waiting)`,
    });
  }

  const stageColon = text.match(
    /^(?:stage|pipeline)\s*[:\-–—]\s*(waiting|my[_ ]?turn|outreach|scheduling|deferred)\s+(?:on\s+)?(.+)$/i,
  );
  if (stageColon) {
    const stageRaw = stageColon[1].toLowerCase().replace(/\s+/g, "_");
    const stage =
      stageRaw === "my_turn" || stageRaw === "myturn"
        ? "my_turn"
        : (stageRaw as PipelineStage);
    return targetAction("set_pipeline", stageColon[2], "Stage", {
      pipelineStage: stage,
    });
  }

  const myTurn = text.match(
    /^(?:your turn(?:\s+on)?|my turn(?:\s+on)?)\s+(.+)$/i,
  );
  if (myTurn) {
    return targetAction("set_pipeline", myTurn[1], "Your turn", {
      pipelineStage: "my_turn",
    });
  }

  const theyReplied = text.match(/^(?:they replied(?:\s+on)?)\s+(.+)$/i);
  if (theyReplied) {
    return targetAction("set_pipeline", theyReplied[1], "They replied", {
      pipelineStage: "scheduling",
    });
  }

  const revisit = text.match(
    /^(?:revisit later(?:\s+on)?|defer(?:\s+follow[- ]?up)?)\s+(.+)$/i,
  );
  if (revisit) {
    return targetAction("set_pipeline", revisit[1], "Revisit later", {
      pipelineStage: "deferred",
    });
  }

  return null;
}

function matchCreateCommands(
  text: string,
  categories: Category[],
): MatchedFeature | null {
  const lead =
    /^(?:please\s+)?(?:can you\s+)?(?:create|make|add|set up|setup|organize)\s+(?:a\s+|an\s+)?(?:new\s+)?/i;

  const folderNamedIn = text.match(
    new RegExp(
      `${lead.source}folder\\s+(?:for|named|called|titled)\\s+(.+?)\\s+(?:in|under|inside)\\s+(?:the\\s+)?(.+)$`,
      "i",
    ),
  );
  if (folderNamedIn) return folderAction(folderNamedIn[1], folderNamedIn[2]);

  const folderNamed = text.match(
    new RegExp(
      `${lead.source}folder\\s+(?:for|named|called|titled)\\s+(.+)$`,
      "i",
    ),
  );
  if (folderNamed) return folderAction(folderNamed[1]);

  const folderInArea = text.match(
    new RegExp(
      `${lead.source}folder\\s+(?:in|under|inside)\\s+(?:the\\s+)?(.+)$`,
      "i",
    ),
  );
  if (folderInArea) {
    const target = cleanName(folderInArea[1]);
    const existingArea = resolveCategoryId(target, categories);
    if (existingArea) return folderAction(target, target);
    return folderAction(target);
  }

  const folderBare = text.match(
    new RegExp(`${lead.source}folder\\s+(.+)$`, "i"),
  );
  if (
    folderBare &&
    !/^(?:in|under|inside|for|named|called)\b/i.test(folderBare[1])
  ) {
    return folderAction(folderBare[1]);
  }

  const shortFolder = text.match(
    /^(?:new\s+)?folder\s*(?::|for|named|called)\s*(.+)$/i,
  );
  if (shortFolder) return folderAction(shortFolder[1]);

  const areaNamed = text.match(
    new RegExp(
      `${lead.source}(?:area|workspace|space)\\s+(?:for|named|called|titled)\\s+(.+)$`,
      "i",
    ),
  );
  if (areaNamed) return areaAction(areaNamed[1]);

  const areaBare = text.match(
    new RegExp(`${lead.source}(?:area|workspace|space)\\s+(.+)$`, "i"),
  );
  if (areaBare) return areaAction(areaBare[1]);

  const shortArea = text.match(
    /^(?:new\s+)?(?:area|workspace)\s*(?::|for|named|called)\s*(.+)$/i,
  );
  if (shortArea) return areaAction(shortArea[1]);

  return null;
}

function matchMetaCommands(
  text: string,
  categories: Category[],
  now: Date,
): MatchedFeature | null {
  if (
    /^(?:park open(?:\s+tasks)?|wrap up and park|park (?:everything|overdue|open tasks)(?:\s+for tomorrow)?)$/i.test(
      text,
    )
  ) {
    const dueAt = parseUntilDate("tomorrow 9am", categories, now);
    return {
      featureId: "park_open",
      title: "Open tasks",
      summary: "Park overdue & due-today until tomorrow 9am",
      dueAt,
    };
  }

  if (
    /^(?:bump all(?:\s+(?:nudges?|chase|follow[- ]?ups?))?|mark all waiting)$/i.test(
      text,
    )
  ) {
    return {
      featureId: "bump_nudges",
      title: "All nudges",
      summary: "Bump all chase follow-ups",
      pipelineStage: "waiting",
    };
  }

  if (/^(?:(?:complete|done|finish) all overdue|clear overdue)$/i.test(text)) {
    return {
      featureId: "complete_overdue",
      title: "Overdue",
      summary: "Complete all overdue tasks",
    };
  }

  if (
    /^(?:export(?:\s+backup)?|download(?:\s+my)?\s+data|backup(?:\s+data)?)$/i.test(
      text,
    )
  ) {
    return {
      featureId: "export_data",
      title: "Backup",
      summary: "Export JSON backup",
    };
  }

  if (
    /^(?:restore(?:\s+from)?(?:\s+auto)?[- ]?backup|restore backup)$/i.test(
      text,
    )
  ) {
    return {
      featureId: "restore_backup",
      title: "Auto-backup",
      summary: "Restore from on-device auto-backup",
    };
  }

  const exportArea = text.match(/^(?:export)\s+(?:area\s+)?(.+)$/i);
  if (exportArea && !/^(?:backup|data)$/i.test(exportArea[1])) {
    const hint = cleanName(exportArea[1]);
    const area = resolveAreaHint(hint, categories);
    if (
      area.categoryId ||
      categories.some((c) =>
        c.name.toLowerCase().startsWith(hint.toLowerCase()),
      )
    ) {
      return {
        featureId: "export_data",
        title: capitalizeName(hint),
        categoryHint: hint,
        categoryId: area.categoryId,
        summary: `Export area “${capitalizeName(hint)}”`,
      };
    }
  }

  const syncSched = text.match(
    /^(?:sync(?:\s+schedule)?|sync notifications)$/i,
  );
  if (syncSched) {
    return {
      featureId: "update_settings",
      title: "Sync schedule",
      summary: "Sync notification schedule",
      settingsPatch: { notificationsEnabled: true },
    };
  }

  const digestOn = text.match(/^(?:turn on|enable)\s+(?:daily\s+)?digest$/i);
  if (digestOn) {
    return {
      featureId: "update_settings",
      title: "Digest on",
      summary: "Turn on daily digest",
      settingsPatch: { digestEnabled: true },
    };
  }

  const digestOff = text.match(/^(?:turn off|disable)\s+(?:daily\s+)?digest$/i);
  if (digestOff) {
    return {
      featureId: "update_settings",
      title: "Digest off",
      summary: "Turn off daily digest",
      settingsPatch: { digestEnabled: false },
    };
  }

  const digestAt = text.match(
    /^(?:digest(?:\s+at)?|set digest(?:\s+to)?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
  );
  if (digestAt) {
    let h = Number(digestAt[1]);
    const m = digestAt[2] ? Number(digestAt[2]) : 0;
    const ap = digestAt[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return {
      featureId: "update_settings",
      title: `Digest ${time}`,
      summary: `Digest at ${time}`,
      settingsPatch: { digestEnabled: true, digestTime: time },
    };
  }

  const weekMon = text.match(
    /^(?:week starts?\s+monday|start week(?:\s+on)?\s+monday)$/i,
  );
  if (weekMon) {
    return {
      featureId: "update_settings",
      title: "Week starts Monday",
      summary: "Week starts on Monday",
      settingsPatch: { weekStartsOnMonday: true },
    };
  }

  const weekSun = text.match(
    /^(?:week starts?\s+sunday|start week(?:\s+on)?\s+sunday)$/i,
  );
  if (weekSun) {
    return {
      featureId: "update_settings",
      title: "Week starts Sunday",
      summary: "Week starts on Sunday",
      settingsPatch: { weekStartsOnMonday: false },
    };
  }

  const defaultArea = text.match(
    /^(?:default area|set default area)\s+(?:to\s+)?(.+)$/i,
  );
  if (defaultArea) {
    const hint = cleanName(defaultArea[1]);
    const area = resolveAreaHint(hint, categories);
    return {
      featureId: "update_settings",
      title: capitalizeName(hint),
      categoryHint: hint,
      summary: `Default area → ${capitalizeName(hint)}`,
      settingsPatch: {
        defaultCategoryId: area.categoryId,
        defaultCategoryHint: hint,
      },
    };
  }

  const defaultRem = text.match(
    /^(?:default reminder|reminders?)\s+(\d+)\s*(?:min(?:ute)?s?|m)(?:\s+before)?(?:\s+by default)?$/i,
  );
  if (defaultRem) {
    const mins = Number(defaultRem[1]);
    return {
      featureId: "update_settings",
      title: `${mins}m reminder`,
      summary: `Default reminder ${mins} minutes before`,
      settingsPatch: { defaultReminderOffsetMinutes: mins },
    };
  }

  const notifOn = text.match(/^(?:turn on|enable)\s+notifications$/i);
  if (notifOn) {
    return {
      featureId: "update_settings",
      title: "Notifications on",
      summary: "Enable notifications",
      settingsPatch: { notificationsEnabled: true },
    };
  }

  const notifOff = text.match(/^(?:turn off|disable)\s+notifications$/i);
  if (notifOff) {
    return {
      featureId: "update_settings",
      title: "Notifications off",
      summary: "Disable notifications",
      settingsPatch: { notificationsEnabled: false },
    };
  }

  return null;
}

const NAV_HEAD = new Set([
  "open",
  "show",
  "go",
  "goto",
  "find",
  "search",
  "look",
  "work",
  "wrap",
  "triage",
  "filter",
]);

const META_HEAD = new Set([
  "park",
  "export",
  "restore",
  "turn",
  "enable",
  "disable",
  "digest",
  "week",
  "start",
  "default",
  "reminders",
  "reminder",
  "sync",
  "bump",
  "complete",
  "done",
  "finish",
  "clear",
  "mark",
]);

const CREATE_HEAD = new Set([
  "create",
  "make",
  "add",
  "set",
  "setup",
  "organize",
  "new",
  "folder",
  "area",
  "workspace",
  "please",
  "can",
]);

/** Match one dump line against app-feature intents (create + control). */
export function matchFeatureIntent(
  line: string,
  categories: Category[] = [],
  now: Date = new Date(),
): MatchedFeature | null {
  const text = normalizePlotLine(line.trim()).replace(/[.!?]+$/, "");
  if (!text) return null;

  const head = text.match(/^[a-zA-Z]+/)?.[0]?.toLowerCase() ?? "";

  // First-word dispatch: skip whole matcher groups on most lines.
  if (NAV_HEAD.has(head)) {
    return (
      matchNavigate(text) ??
      matchMetaCommands(text, categories, now) ??
      matchItemCommands(text, categories, now)
    );
  }

  if (META_HEAD.has(head)) {
    return (
      matchMetaCommands(text, categories, now) ??
      matchItemCommands(text, categories, now) ??
      matchNavigate(text) ??
      matchCreateCommands(text, categories)
    );
  }

  if (CREATE_HEAD.has(head)) {
    return (
      matchItemCommands(text, categories, now) ??
      matchCreateCommands(text, categories) ??
      matchMetaCommands(text, categories, now)
    );
  }

  return (
    matchItemCommands(text, categories, now) ??
    matchNavigate(text) ??
    matchMetaCommands(text, categories, now) ??
    matchCreateCommands(text, categories)
  );
}

export function featureIntentToProposal(
  match: MatchedFeature,
  categories: Category[],
): ProposedFeatureAction {
  const area = resolveAreaHint(
    match.categoryHint ?? match.patch?.categoryHint,
    categories,
  );
  return {
    id: uuidv4(),
    kind: match.featureId,
    title: match.title,
    categoryId:
      match.categoryId ??
      match.patch?.categoryId ??
      area.categoryId ??
      (match.featureId === "create_folder" ? categories[0]?.id : undefined),
    categoryHint: area.categoryHint ?? match.categoryHint,
    summary: match.summary,
    selected: true,
    targetQuery: match.targetQuery,
    dueAt: match.dueAt,
    patch: match.patch
      ? {
          ...match.patch,
          categoryId:
            match.patch.categoryId ?? area.categoryId ?? match.categoryId,
          categoryHint: match.patch.categoryHint ?? area.categoryHint,
        }
      : undefined,
    navigateTo: match.navigateTo,
    openSheet: match.openSheet,
    pipelineStage: match.pipelineStage,
    settingsPatch: match.settingsPatch,
    areaPatch: match.areaPatch,
  };
}

export function buildFeatureCatalogPrompt(categories: Category[]): string {
  const areas = categories.map((c) => c.name).join(", ") || "Work, Personal";
  const lines = APP_FEATURES.map((f) => `${f.id}: ${f.description}`).join("\n");
  return `Actions (not items[]):\n${lines}\nAreas: ${areas}.
Control actions need targetQuery = existing task title. navigate needs navigateTo.`;
}

const ALL_KINDS = new Set<AppFeatureId>(APP_FEATURES.map((f) => f.id));

export function isFeatureActionKind(
  value: string | undefined,
): value is AppFeatureId {
  return Boolean(value && ALL_KINDS.has(value as AppFeatureId));
}

const FEATURE_LABELS = new Map(APP_FEATURES.map((f) => [f.id, f.label]));

export function featureLabel(kind: AppFeatureId): string {
  return FEATURE_LABELS.get(kind) ?? kind;
}

export function isControlAction(kind: AppFeatureId): boolean {
  return (
    kind !== "create_folder" &&
    kind !== "create_area" &&
    kind !== "navigate" &&
    kind !== "export_data" &&
    kind !== "update_settings" &&
    kind !== "park_open" &&
    kind !== "bump_nudges" &&
    kind !== "complete_overdue" &&
    kind !== "restore_backup" &&
    kind !== "update_area"
  );
}
