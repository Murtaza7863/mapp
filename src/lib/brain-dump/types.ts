import type { ItemType, PipelineStage, RecurrenceRule } from "../../types";

/** App capabilities Plot can apply from a dump (not only create tasks). */
export type AppFeatureId =
  | "create_folder"
  | "create_area"
  | "complete_item"
  | "snooze_item"
  | "unsnooze_item"
  | "delete_item"
  | "update_item"
  | "set_pipeline"
  | "navigate"
  | "reopen_item"
  | "rename_area"
  | "delete_area"
  | "delete_folder"
  | "park_open"
  | "export_data"
  | "update_settings"
  | "rename_folder"
  | "bump_nudges"
  | "complete_overdue"
  | "duplicate_item"
  | "move_folder"
  | "update_area"
  | "restore_backup";

export interface ProposedItem {
  /** Client-only id for the confirmation UI */
  id: string;
  title: string;
  type: ItemType;
  categoryId?: string;
  categoryHint?: string;
  /** Nest under this folder when saving (created if missing) */
  parentFolderName?: string;
  childGroup?: string;
  dueAt?: string;
  priority: boolean;
  notes?: string;
  contactName?: string;
  pipelineStage?: PipelineStage;
  selected: boolean;
  /** Hierarchy Plot will create or use when saving */
  structure?: import("./structure-parser").PlotStructure;
  /** Human-readable plan notes for the confirm sheet */
  planNotes?: string[];
}

export interface ProposedItemPatch {
  title?: string;
  categoryId?: string;
  categoryHint?: string;
  type?: ItemType;
  priority?: boolean;
  notes?: string;
  /** Nest under folder by name; null clears parent */
  parentFolderName?: string | null;
  pipelineStage?: PipelineStage;
  dueAt?: string | null;
  recurrence?: RecurrenceRule | null;
  contactName?: string | null;
  nextAction?: string | null;
  checkBackAt?: string | null;
  linkedEventAt?: string | null;
  notificationsMuted?: boolean;
  reminderOffsetMinutes?: number | null;
  childGroup?: string | null;
  lastContactAt?: string | null;
  goalCount?: number | null;
}

export interface ProposedSettingsPatch {
  digestEnabled?: boolean;
  digestTime?: string;
  notificationsEnabled?: boolean;
  defaultReminderOffsetMinutes?: number;
  weekStartsOnMonday?: boolean;
  defaultCategoryId?: string;
  defaultCategoryHint?: string;
}

export interface ProposedAreaPatch {
  color?: string;
  icon?: string;
  subgroups?: string[];
}

/** App-feature intents — create, update existing work, or navigate. */
export interface ProposedFeatureAction {
  id: string;
  kind: AppFeatureId;
  /** Folder/area name, or resolved item title, or navigate label */
  title: string;
  categoryId?: string;
  categoryHint?: string;
  /** Confirm-sheet summary line */
  summary: string;
  selected: boolean;
  /** Raw query used to find an existing item */
  targetQuery?: string;
  /** Filled when a unique match is found */
  resolvedItemId?: string;
  matchCandidates?: Array<{ id: string; title: string; score: number }>;
  /** Snooze-until or reschedule target */
  dueAt?: string;
  patch?: ProposedItemPatch;
  settingsPatch?: ProposedSettingsPatch;
  areaPatch?: ProposedAreaPatch;
  navigateTo?: string;
  openSheet?: "wrapup" | "triage";
  pipelineStage?: PipelineStage;
}

export interface ParseDumpResult {
  items: ProposedItem[];
  actions: ProposedFeatureAction[];
  clarifications: string[];
  source: "llm" | "rules";
}

export interface ModelParsePayload {
  items: Array<{
    title: string;
    type?: string;
    categoryHint?: string;
    dueAt?: string | null;
    priority?: boolean;
    notes?: string | null;
    contactName?: string | null;
    pipelineStage?: string | null;
  }>;
  actions?: Array<{
    kind?: string;
    title?: string;
    categoryHint?: string | null;
    targetQuery?: string | null;
    dueAt?: string | null;
    navigateTo?: string | null;
    pipelineStage?: string | null;
    priority?: boolean | null;
    nextAction?: string | null;
    contactName?: string | null;
  }>;
  clarifications?: string[];
}
