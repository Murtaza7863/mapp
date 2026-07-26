import { v4 as uuidv4 } from "uuid";
import { getNextOccurrence } from "./dates";
import type { Item, ItemInput, RecurrenceRule } from "../types";

export function createItem(
  input: Partial<ItemInput> & { title: string },
): Item {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    type: input.type ?? "deadline",
    categoryId: input.categoryId ?? "",
    title: input.title,
    notes: input.notes,
    dueAt: input.dueAt,
    recurrence: input.recurrence,
    status: "pending",
    priority: input.priority ?? false,
    waitingOn: input.waitingOn,
    contactName: input.contactName,
    pipelineStage:
      input.pipelineStage ??
      (input.type === "follow-up" ? "outreach" : undefined),
    checkBackAt: input.checkBackAt,
    lastContactAt:
      input.lastContactAt ?? (input.type === "follow-up" ? now : undefined),
    nextAction: input.nextAction,
    linkedEventAt: input.linkedEventAt,
    reminderOffsetMinutes: input.reminderOffsetMinutes,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
    goalCount: input.goalCount,
    childGroup: input.childGroup,
    schoolKind: input.schoolKind,
    createdAt: now,
    updatedAt: now,
  };
}

export function completeItem(item: Item, completedAt?: string): Item {
  const now = completedAt ?? new Date().toISOString();

  if (item.type === "routine" && item.recurrence) {
    const nextDue = getNextOccurrence(
      item.recurrence,
      item.dueAt ? new Date(item.dueAt) : new Date(),
    );
    return {
      ...item,
      status: "pending",
      dueAt: nextDue.toISOString(),
      completedAt: now,
      updatedAt: now,
      snoozedUntil: undefined,
    };
  }

  return {
    ...item,
    status: "done",
    completedAt: now,
    updatedAt: now,
    snoozedUntil: undefined,
  };
}

export function snoozeItem(item: Item, until: Date): Item {
  return {
    ...item,
    status: "snoozed",
    snoozedUntil: until.toISOString(),
    // Reschedule so calendar, Today, and push all align when snooze ends.
    dueAt: until.toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function wakeSnoozedItem(item: Item): Item {
  if (item.status !== "snoozed") return item;
  return {
    ...item,
    status: "pending",
    snoozedUntil: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function reopenItem(item: Item): Item {
  return {
    ...item,
    status: "pending",
    completedAt: undefined,
    snoozedUntil: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function defaultRecurrence(): RecurrenceRule {
  return { frequency: "daily" };
}

export function isActionable(item: Item): boolean {
  return (
    item.type !== "follow-up" && item.type !== "note" && item.type !== "project"
  );
}
