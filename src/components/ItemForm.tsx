import { addDays, format, nextMonday, setHours, setMinutes } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";

import type {
  Category,
  Item,
  ItemType,
  PipelineStage,
  RecurrenceRule,
} from "../types";

import { db } from "../db";
import { defaultRecurrence } from "../lib/items";
import { gpdDueFromEvent } from "../lib/pipeline";
import { getLastCategoryId } from "../lib/preferences";
import {
  REMINDER_OFFSET_OPTIONS,
  ITEM_TYPE_LABELS,
  PIPELINE_STAGE_LABELS,
  SCHOOL_KIND_LABELS,
} from "../types";
import { DatePickerField, TimePickerField } from "./DatePickerField";
import { CloseIcon, StarIcon } from "./icons";

interface Props {
  categories: Category[];
  item?: Item | null;
  defaultType?: ItemType;
  defaultParentId?: string;
  defaultChildGroup?: string;
  defaultCategoryId?: string;
  lockCategoryId?: string;
  childGroupOptions?: string[];
  defaultDueDate?: string;
  onSave: (data: Partial<Item> & { title: string }) => void | Promise<void>;
  onClose: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ItemForm({
  categories,
  item,
  defaultType,
  defaultParentId,
  defaultChildGroup,
  defaultCategoryId,
  lockCategoryId,
  childGroupOptions = [],
  defaultDueDate,
  onSave,
  onClose,
}: Props) {
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const isChildForm = Boolean(item?.parentId ?? defaultParentId);
  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState<ItemType>(
    item?.type ?? defaultType ?? "deadline",
  );
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ??
      lockCategoryId ??
      defaultCategoryId ??
      settings?.defaultCategoryId ??
      getLastCategoryId() ??
      categories[0]?.id ??
      "",
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [contactName, setContactName] = useState(
    item?.contactName ?? item?.waitingOn ?? "",
  );
  const [pipelineStage, setPipelineStage] = useState(
    item?.pipelineStage ?? "outreach",
  );
  const [nextAction, setNextAction] = useState(item?.nextAction ?? "");
  const [checkBackDate, setCheckBackDate] = useState(
    item?.checkBackAt?.slice(0, 10) ?? "",
  );
  const [lastContactDate, setLastContactDate] = useState(
    item?.lastContactAt?.slice(0, 10) ?? "",
  );
  const [linkedEventDate, setLinkedEventDate] = useState(
    item?.linkedEventAt?.slice(0, 10) ?? "",
  );
  const [priority, setPriority] = useState(item?.priority ?? false);
  const [notificationsMuted, setNotificationsMuted] = useState(
    item?.notificationsMuted ?? false,
  );
  const [dueDate, setDueDate] = useState(() => {
    if (item?.dueAt) return item.dueAt.slice(0, 10);
    return defaultDueDate ?? "";
  });
  const [dueTime, setDueTime] = useState(() => {
    if (!item?.dueAt) return "09:00";
    return item.dueAt.slice(11, 16);
  });
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(
    item?.recurrence ?? defaultRecurrence(),
  );
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(
    item?.reminderOffsetMinutes ?? settings?.defaultReminderOffsetMinutes ?? 0,
  );
  const [goalCount, setGoalCount] = useState(item?.goalCount?.toString() ?? "");
  const [childGroup, setChildGroup] = useState(() => {
    if (item?.childGroup) return item.childGroup;
    if (item?.schoolKind) return SCHOOL_KIND_LABELS[item.schoolKind];
    return defaultChildGroup ?? "";
  });
  const [saving, setSaving] = useState(false);

  const typeOptions = useMemo(() => {
    const all = Object.keys(ITEM_TYPE_LABELS) as ItemType[];
    if (isChildForm) return all.filter((t) => t !== "project");
    if (defaultType === "project" && !item) return ["project"] as ItemType[];
    return all;
  }, [isChildForm, defaultType, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    let dueAt: string | undefined;
    if (dueDate) {
      dueAt = new Date(`${dueDate}T${dueTime || "09:00"}`).toISOString();
    } else if (type === "follow-up" && linkedEventDate) {
      dueAt = gpdDueFromEvent(
        new Date(`${linkedEventDate}T00:00`).toISOString(),
      ).toISOString();
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        type,
        categoryId: lockCategoryId ?? categoryId,
        notes: notes.trim() || undefined,
        parentId: item?.parentId ?? defaultParentId,
        goalCount:
          type === "project" && goalCount
            ? Math.max(1, parseInt(goalCount, 10) || 0)
            : undefined,
        childGroup: isChildForm && childGroup ? childGroup : undefined,
        waitingOn:
          type === "follow-up" ? contactName.trim() || undefined : undefined,
        contactName:
          type === "follow-up" ? contactName.trim() || undefined : undefined,
        pipelineStage: type === "follow-up" ? pipelineStage : undefined,
        nextAction:
          type === "follow-up" ? nextAction.trim() || undefined : undefined,
        checkBackAt:
          type === "follow-up" && checkBackDate
            ? new Date(`${checkBackDate}T09:00`).toISOString()
            : undefined,
        lastContactAt:
          type === "follow-up" && lastContactDate
            ? new Date(`${lastContactDate}T12:00`).toISOString()
            : undefined,
        linkedEventAt:
          type === "follow-up" && linkedEventDate
            ? new Date(`${linkedEventDate}T00:00`).toISOString()
            : undefined,
        priority,
        notificationsMuted: notificationsMuted || undefined,
        dueAt,
        reminderOffsetMinutes:
          type !== "note" ? reminderOffsetMinutes : undefined,
        recurrence: type === "routine" ? recurrence : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    const days = recurrence.daysOfWeek ?? [];
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    setRecurrence({
      ...recurrence,
      frequency: "custom",
      daysOfWeek: next.sort(),
    });
  };

  return (
    <div className="bg-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="modal-sheet max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl">
        <div className="modal-accent-bar rounded-t-3xl sm:rounded-t-3xl" />
        <div className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-primary text-lg font-semibold">
              {item ? "Edit item" : "New item"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="bg-paper text-muted hover:text-primary rounded-full p-2"
              aria-label="Close"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="section-label mb-1.5 block">Title</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field w-full rounded-xl px-3 py-3"
                placeholder="Title"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label mb-1.5 block">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ItemType)}
                  className="input-field w-full rounded-xl px-3 py-2.5"
                  disabled={typeOptions.length === 1}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {ITEM_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="section-label mb-1.5 block">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="input-field w-full rounded-xl px-3 py-2.5"
                  disabled={Boolean(lockCategoryId)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {type === "project" && (
              <div>
                <label className="section-label mb-1.5 block">
                  Goal count (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={goalCount}
                  onChange={(e) => setGoalCount(e.target.value)}
                  className="input-field w-full rounded-xl px-3 py-2.5"
                  placeholder="e.g. 5 new companies"
                />
              </div>
            )}

            {childGroupOptions.length > 0 && isChildForm && (
              <div>
                <label className="section-label mb-1.5 block">Subgroup</label>
                <div className="flex flex-wrap gap-2">
                  {childGroupOptions.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setChildGroup(label)}
                      className={`rounded-xl px-3 py-1.5 text-sm ${
                        childGroup === label
                          ? "filter-pill-active"
                          : "filter-pill"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type !== "note" && type !== "project" && (
              <div>
                <label className="section-label mb-1.5 block">Date</label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[
                    { label: "Today", date: format(new Date(), "yyyy-MM-dd") },
                    {
                      label: "Tomorrow",
                      date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
                    },
                    {
                      label: "Next Mon",
                      date: format(nextMonday(new Date()), "yyyy-MM-dd"),
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDueDate(preset.date)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs ${
                        dueDate === preset.date
                          ? "filter-pill-active"
                          : "filter-pill"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DatePickerField value={dueDate} onChange={setDueDate} />
                  <TimePickerField value={dueTime} onChange={setDueTime} />
                </div>
              </div>
            )}

            {type === "follow-up" && (
              <div className="border-rule space-y-3 rounded-xl border p-3.5">
                <div>
                  <label className="section-label mb-1.5 block">
                    Company / person
                  </label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="input-field w-full rounded-xl px-3 py-2.5"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="section-label mb-1.5 block">Stage</label>
                  <select
                    value={pipelineStage}
                    onChange={(e) =>
                      setPipelineStage(e.target.value as PipelineStage)
                    }
                    className="input-field w-full rounded-xl px-3 py-2.5"
                  >
                    {(
                      Object.keys(PIPELINE_STAGE_LABELS) as PipelineStage[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {PIPELINE_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="section-label mb-1.5 block">
                    Next action (your move)
                  </label>
                  <input
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="input-field w-full rounded-xl px-3 py-2.5"
                    placeholder="e.g. Send follow-up email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="section-label mb-1.5 block">
                      Look back on
                    </label>
                    <DatePickerField
                      value={checkBackDate}
                      onChange={setCheckBackDate}
                      placeholder="Pick date"
                    />
                  </div>
                  <div>
                    <label className="section-label mb-1.5 block">
                      Last contact
                    </label>
                    <DatePickerField
                      value={lastContactDate}
                      onChange={setLastContactDate}
                      placeholder="Pick date"
                    />
                  </div>
                </div>
                <div>
                  <label className="section-label mb-1.5 block">
                    Linked event
                  </label>
                  <DatePickerField
                    value={linkedEventDate}
                    onChange={setLinkedEventDate}
                    placeholder="Event date"
                  />
                  {linkedEventDate && (
                    <p className="text-muted mt-1 text-[11px]">
                      Prep due ~{" "}
                      {format(
                        gpdDueFromEvent(
                          new Date(`${linkedEventDate}T00:00`).toISOString(),
                        ),
                        "MMM d, yyyy",
                      )}{" "}
                      (10 weeks before)
                    </p>
                  )}
                </div>
              </div>
            )}

            {type === "routine" && (
              <div>
                <label className="section-label mb-1.5 block">Recurrence</label>
                <div className="flex flex-wrap gap-2">
                  {(["daily", "weekdays", "weekly"] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() =>
                        setRecurrence({
                          frequency: freq,
                          daysOfWeek:
                            freq === "weekly"
                              ? [new Date().getDay()]
                              : undefined,
                        })
                      }
                      className={`rounded-xl px-3 py-1.5 text-sm capitalize ${
                        recurrence.frequency === freq
                          ? "filter-pill-active"
                          : "filter-pill"
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {WEEKDAYS.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`rounded-lg px-2 py-1 text-xs ${
                        recurrence.daysOfWeek?.includes(i)
                          ? "filter-pill-active"
                          : "filter-pill"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type !== "note" && type !== "project" && (
              <div>
                <label className="section-label mb-1.5 block">Remind me</label>
                <select
                  value={reminderOffsetMinutes}
                  onChange={(e) =>
                    setReminderOffsetMinutes(Number(e.target.value))
                  }
                  className="input-field w-full rounded-xl px-3 py-2.5"
                >
                  {REMINDER_OFFSET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="section-label mb-1.5 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input-field w-full rounded-xl px-3 py-2.5"
                placeholder="Optional"
              />
            </div>

            <label className="border-rule bg-paper text-primary flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={notificationsMuted}
                onChange={(e) => setNotificationsMuted(e.target.checked)}
                className="rounded accent-[var(--color-block)]"
              />
              Mute notifications for this item
            </label>

            <label className="border-rule bg-paper text-primary flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={priority}
                onChange={(e) => setPriority(e.target.checked)}
                className="rounded accent-[var(--color-block)]"
              />
              <StarIcon filled={priority} className="text-warn h-3.5 w-3.5" />
              Priority
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1 rounded-xl py-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 rounded-xl py-3 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function SnoozeSheet({
  onSelect,
  onClose,
  isSnoozed,
  onWakeNow,
}: {
  onSelect: (date: Date) => void;
  onClose: () => void;
  isSnoozed?: boolean;
  onWakeNow?: () => void;
}) {
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");
  const [showCustom, setShowCustom] = useState(false);

  const presets = [
    { label: "1 hour", date: new Date(Date.now() + 3600000) },
    { label: "3 hours", date: new Date(Date.now() + 3 * 3600000) },
    { label: "+3 days", date: addDays(new Date(), 3) },
    {
      label: "Tomorrow 9am",
      date: setMinutes(setHours(addDays(new Date(), 1), 9), 0),
    },
    {
      label: "Next Monday 9am",
      date: setMinutes(setHours(nextMonday(new Date()), 9), 0),
    },
    { label: "Next week", date: addDays(new Date(), 7) },
  ];

  return (
    <div
      className="bg-overlay fixed inset-0 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="modal-sheet max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-accent-bar rounded-t-3xl" />
        <div className="p-5">
          <h3 className="text-primary mb-4 text-lg font-semibold">
            {isSnoozed ? "Snooze again or wake" : "Snooze until"}
          </h3>
          {onWakeNow && (
            <button
              type="button"
              onClick={onWakeNow}
              className="border-emerald-200 bg-emerald-50 text-emerald-800 mb-3 w-full rounded-2xl border px-4 py-3.5 text-left font-medium"
            >
              Wake now
            </button>
          )}
          <div className="space-y-2">
            {presets.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => onSelect(o.date)}
                className="glass-card glass-card-hover text-primary w-full rounded-2xl px-4 py-3.5 text-left"
              >
                {o.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="btn-ghost w-full rounded-2xl px-4 py-3.5 text-left"
            >
              Pick date & time…
            </button>
          </div>

          {showCustom && (
            <div className="border-rule mt-4 space-y-3 border-t pt-4">
              <div className="grid grid-cols-2 gap-2">
                <DatePickerField
                  value={customDate}
                  onChange={setCustomDate}
                  placeholder="Date"
                />
                <TimePickerField value={customTime} onChange={setCustomTime} />
              </div>
              <button
                type="button"
                disabled={!customDate}
                onClick={() =>
                  onSelect(new Date(`${customDate}T${customTime || "09:00"}`))
                }
                className="btn-primary w-full rounded-xl py-3 disabled:opacity-40"
              >
                Snooze
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
