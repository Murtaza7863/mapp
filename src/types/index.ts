export type ItemType =
  | "deadline"
  | "routine"
  | "follow-up"
  | "note"
  | "project";

export type SchoolKind = "homework" | "exam";

export type ItemStatus = "pending" | "done" | "snoozed";

/** Where a follow-up / outreach thread sits — not a calendar date. */
export type PipelineStage =
  | "outreach"
  | "waiting"
  | "scheduling"
  | "deferred"
  | "my_turn";

export type RecurrenceFrequency = "daily" | "weekdays" | "weekly" | "custom";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  daysOfWeek?: number[];
  interval?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  /** Optional sub-groups inside folders (e.g. Homework, Exam) */
  subgroups?: string[];
}

export interface Item {
  id: string;
  type: ItemType;
  categoryId: string;
  title: string;
  notes?: string;
  dueAt?: string;
  recurrence?: RecurrenceRule;
  status: ItemStatus;
  priority: boolean;
  completedAt?: string;
  snoozedUntil?: string;
  waitingOn?: string;
  /** Company or person for follow-up threads */
  contactName?: string;
  pipelineStage?: PipelineStage;
  /** "Look back on this later" — resurfaces when due */
  checkBackAt?: string;
  lastContactAt?: string;
  nextAction?: string;
  /** Linked event date — prep deadline can be derived (10 weeks before) */
  linkedEventAt?: string;
  reminderOffsetMinutes?: number;
  /** Parent project / folder */
  parentId?: string;
  sortOrder?: number;
  /** Target count for outreach-style projects (e.g. 5 new companies) */
  goalCount?: number;
  /** Subgroup label inside a folder — configured per area */
  childGroup?: string;
  /** @deprecated use childGroup — kept for existing data */
  schoolKind?: SchoolKind;
  /** Skip push notifications for this item */
  notificationsMuted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompletionLog {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
  categoryId: string;
  completedAt: string;
  notes?: string;
}

export interface DbBackup {
  id: "latest" | "previous";
  savedAt: string;
  data: string;
}

export interface AppSettings {
  id: "app";
  digestEnabled: boolean;
  digestTime: string;
  notificationsEnabled: boolean;
  deviceId: string;
  defaultReminderOffsetMinutes: number;
  weekStartsOnMonday: boolean;
  /** Default area for new items from Home */
  defaultCategoryId?: string;
  /** Last push schedule sync error */
  lastSyncError?: string;
  /** ISO timestamp of last auto-backup snapshot */
  lastAutoBackupAt?: string;
  /** ISO timestamp of last manual JSON export */
  lastManualBackupAt?: string;
}

export type ItemInput = Omit<Item, "id" | "createdAt" | "updatedAt">;

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  deadline: "Deadline",
  routine: "Routine",
  "follow-up": "Follow-up",
  note: "Note",
  project: "Project",
};

export const SCHOOL_KIND_LABELS: Record<SchoolKind, string> = {
  homework: "Homework",
  exam: "Exam",
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  outreach: "Outreach sent",
  waiting: "Waiting on them",
  scheduling: "Scheduling stalled",
  deferred: "Revisit later",
  my_turn: "Your turn",
};

export const REMINDER_OFFSET_OPTIONS = [
  { label: "At due time", value: 0 },
  { label: "5 min before", value: 5 },
  { label: "15 min before", value: 15 },
  { label: "30 min before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "1 day before", value: 1440 },
];

export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Work", color: "#3b82f6", icon: "briefcase", sortOrder: 0 },
  { name: "Personal", color: "#22c55e", icon: "home", sortOrder: 1 },
];
