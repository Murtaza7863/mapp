/** JSON schema for WebLLM constrained generation. */
export const PLOT_OUTPUT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: {
            type: "string",
            enum: ["deadline", "routine", "follow-up", "note", "project"],
          },
          categoryHint: { type: ["string", "null"] },
          dueAt: { type: ["string", "null"] },
          priority: { type: "boolean" },
          contactName: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["create_folder", "create_area"] },
          title: { type: "string" },
          categoryHint: { type: ["string", "null"] },
        },
        required: ["kind", "title"],
        additionalProperties: false,
      },
    },
    clarifications: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["items", "actions", "clarifications"],
  additionalProperties: false,
});

export const PLOT_SYSTEM_PROMPT = `You extract actionable tasks and app-feature intents from brain dumps.
Return JSON matching the schema exactly.

Task types: deadline, routine, follow-up, note, project.
actions[]: create_folder or create_area when user asks to create folders/areas/workspaces — NOT fake deadline items.
contactName for follow-ups. categoryHint from areas or #tags. priority true when ! or urgent.
dueAt: ISO 8601 UTC from relative dates using the provided today date.
title: short polished phrase. clarifications: [] if none.`;
