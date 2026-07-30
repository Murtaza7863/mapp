import type { Category, Item } from "../../types";

import { buildFeatureCatalogPrompt } from "./features";
import type { ProposedItem } from "./types";

/** Lean few-shots — enough signal for create vs control, not a full catalog. */
const FEW_SHOT = `Examples (today: 2026-07-26):
"email prof tomorrow #work" → item { title:"Email prof", type:"deadline", categoryHint:"Work", dueAt:"2026-07-27T13:00:00.000Z" }
"follow up with acme by friday for ATLAS" → item { title:"Follow up — Acme", type:"follow-up", categoryHint:"ATLAS", contactName:"Acme", dueAt:"2026-07-31T13:00:00.000Z" }
"pay rent tomorrow !, gym friday #personal" → 2 items (priority rent; gym routine)
"done: pay rent" → action complete_item targetQuery:"pay rent"
"snooze call mom until friday" → action snooze_item dueAt friday
"delete gym" / "reopen pay rent" / "star gym" / "duplicate gym" → matching actions
"move essay to #personal" → update_item categoryHint
"reschedule rent to monday" → update_item dueAt
"mark acme waiting" → set_pipeline waiting (bare "bump acme" stays a new follow-up item)
"file visa in Smubia folder" → update_item (nest existing; "put X in Y folder" creates)
"open calendar" / "find rent" / "open folder Smubia" → navigate
"park open tasks" / "bump all nudges" / "complete all overdue" / "export backup" → matching actions
"turn on digest" → update_settings
"create a folder for smubia" → create_folder
"rename folder Smubia to Atlas" → rename_folder`;

export function buildPlotLlmPrompt(
  dump: string,
  categories: Category[],
  rulesPreview: ProposedItem[] = [],
  now: Date = new Date(),
  pendingItems: Item[] = [],
): string {
  const today = now.toISOString().slice(0, 10);
  const areas = categories.map((c) => c.name).join(", ") || "Work, Personal";
  const preview =
    rulesPreview.length > 0
      ? rulesPreview
          .map(
            (item) =>
              `- ${item.title}${item.dueAt ? ` (due ${item.dueAt.slice(0, 10)})` : ""}`,
          )
          .join("\n")
      : "none yet";

  const catalog = pendingItems
    .filter((i) => i.status === "pending" || i.status === "snoozed")
    .slice(0, 20)
    .map((i) => `- ${i.title}${i.status === "snoozed" ? " (snoozed)" : ""}`)
    .join("\n");

  return `Today: ${today}
Areas: ${areas}

${buildFeatureCatalogPrompt(categories)}

Existing tasks (targetQuery):
${catalog || "none"}

Rules preview:
${preview}

${FEW_SHOT.replace("2026-07-26", today)}

Brain dump:
${dump.trim()}`;
}

export function estimatePlotMaxTokens(text: string): number {
  const lines = Math.max(1, text.split(/\n+/).length);
  const commas = (text.match(/,/g) ?? []).length;
  const segments = Math.max(lines, commas + 1);
  return Math.min(720, 140 + segments * 80);
}
