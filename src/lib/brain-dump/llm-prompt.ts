import type { Category } from "../../types";

import { buildFeatureCatalogPrompt } from "./features";
import type { ProposedItem } from "./types";

const FEW_SHOT = `Examples (today: 2026-07-26):

Input: "email prof about extension tomorrow #work"
Output item: { title: "Email prof about extension", type: "follow-up", categoryHint: "Work", dueAt: "2026-07-27T13:00:00.000Z", priority: false, contactName: "Prof" }

Input: "just finished call with acme corp, follow up with them by next friday for ATLAS"
Output item: { title: "Follow up — Acme Corp", type: "follow-up", categoryHint: "ATLAS", dueAt: "2026-08-01T13:00:00.000Z", priority: false, contactName: "Acme Corp" }

Input: "pay rent tomorrow !, gym friday #personal"
Output items: [
  { title: "Pay rent", type: "deadline", categoryHint: "Personal", dueAt: "2026-07-27T13:00:00.000Z", priority: true },
  { title: "Gym", type: "routine", categoryHint: "Personal", dueAt: "2026-08-01T13:00:00.000Z", priority: false }
]`;

export function buildPlotLlmPrompt(
  dump: string,
  categories: Category[],
  rulesPreview: ProposedItem[] = [],
  now: Date = new Date(),
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

  return `Today: ${today}
Areas: ${areas}

${buildFeatureCatalogPrompt(categories)}

Quick parser preview (improve, fix dates/types, add missing tasks):
${preview}

${FEW_SHOT.replace("2026-07-26", today)}

Brain dump:
${dump.trim()}`;
}

export function estimatePlotMaxTokens(text: string): number {
  const lines = Math.max(1, text.split(/\n+/).length);
  const commas = (text.match(/,/g) ?? []).length;
  const segments = Math.max(lines, commas + 1);
  return Math.min(640, 120 + segments * 72);
}
