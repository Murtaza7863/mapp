import type { ItemType, PipelineStage } from "../../types";

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

export interface ParseDumpResult {
  items: ProposedItem[];
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
  clarifications?: string[];
}
