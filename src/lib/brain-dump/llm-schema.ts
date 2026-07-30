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
          kind: {
            type: "string",
            enum: [
              "create_folder",
              "create_area",
              "complete_item",
              "snooze_item",
              "unsnooze_item",
              "delete_item",
              "update_item",
              "set_pipeline",
              "navigate",
              "reopen_item",
              "rename_area",
              "delete_area",
              "delete_folder",
              "park_open",
              "export_data",
              "update_settings",
              "rename_folder",
              "bump_nudges",
              "complete_overdue",
              "duplicate_item",
              "move_folder",
              "update_area",
              "restore_backup",
            ],
          },
          title: { type: "string" },
          categoryHint: { type: ["string", "null"] },
          targetQuery: { type: ["string", "null"] },
          dueAt: { type: ["string", "null"] },
          navigateTo: { type: ["string", "null"] },
          pipelineStage: { type: ["string", "null"] },
          priority: { type: ["boolean", "null"] },
          nextAction: { type: ["string", "null"] },
          contactName: { type: ["string", "null"] },
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

export const PLOT_SYSTEM_PROMPT = `You extract actionable tasks AND app-control intents from brain dumps.
Return JSON matching the schema exactly.

Task types: deadline, routine, follow-up, note, project — put NEW work in items[].
actions[] control the app:
- create_folder / create_area: create containers
- complete_item / reopen_item / snooze_item / unsnooze_item / delete_item: change EXISTING tasks (set targetQuery)
- update_item: move/file into folder, reschedule, rename, star, mute, note, next action — set targetQuery
- set_pipeline: waiting / my_turn / scheduling / deferred on a follow-up
- rename_area / delete_area / delete_folder / rename_folder / move_folder: manage containers
- update_area: recolor or set subgroups on an area
- park_open / bump_nudges / complete_overdue: bulk day actions
- duplicate_item: copy an existing task
- export_data / restore_backup / update_settings: backup or prefs
- navigate: open a screen (navigateTo like /calendar, /folders, /insights, /?focus=chase)
Never invent fake deadline items for control phrases like "done: rent" or "open calendar".
contactName for follow-ups. categoryHint from areas or #tags. priority true when ! or urgent.
dueAt: ISO 8601 UTC from relative dates using the provided today date.
title: short polished phrase. clarifications: [] if none.`;
