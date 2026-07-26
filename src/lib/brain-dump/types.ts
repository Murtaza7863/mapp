import type { ItemType, PipelineStage } from "../../types";

/** App capabilities Plot can apply from a dump (not task items). */
export type AppFeatureId = "create_folder" | "create_area";

export interface ProposedItem {
  /** Client-only id for the confirmation UI */
  id: string;
  title: string;
  type: ItemType;
  categoryId?: string;
  categoryHint?: string;
  dueAt?: string;
  priority: boolean;
  notes?: string;
  contactName?: string;
  pipelineStage?: PipelineStage;
  selected: boolean;
}

/** App-feature intents (create folder/area) — not reminder items. */
export interface ProposedFeatureAction {
  id: string;
  kind: AppFeatureId;
  /** Folder or area name */
  title: string;
  categoryId?: string;
  categoryHint?: string;
  /** Confirm-sheet summary line */
  summary: string;
  selected: boolean;
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
  }>;
  clarifications?: string[];
}
