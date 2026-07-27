import {
  addMonths,
  addWeeks,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  subMonths,
  subWeeks,
} from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";

import type { Category, Item } from "../types";

import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SwipeItem } from "../components/SwipeItem";
import { FilterPill, PageHeader } from "../components/ui";
import { db } from "../db";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import { buildCalendarIndex, type CalendarEntry } from "../lib/calendar";
import { startOfMonthGrid, startOfWeekGrid } from "../lib/dates";

type CalendarMode = "month" | "week";

export function CalendarView() {
  const {
    items,
    addItem,
    updateItem,
    deleteItem,
    restoreItem,
    markDone,
    snooze,
    unsnooze,
  } = useItems();
  const { categories, getCategory } = useCategories();
  const { deleteWithUndo } = useUndo();
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);

  const weekStartsOnMonday = settings?.weekStartsOnMonday ?? false;

  const grid = useMemo(() => {
    if (mode === "month") return startOfMonthGrid(anchor);
    return startOfWeekGrid(anchor, weekStartsOnMonday);
  }, [mode, anchor, weekStartsOnMonday]);

  const calendarIndex = useMemo(() => buildCalendarIndex(items), [items]);

  const selectedEntries = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return (calendarIndex.get(key) ?? []).sort((a, b) => {
      const aTime = a.item.dueAt ? parseISO(a.item.dueAt).getTime() : 0;
      const bTime = b.item.dueAt ? parseISO(b.item.dueAt).getTime() : 0;
      return aTime - bTime;
    });
  }, [selectedDay, calendarIndex]);

  const navigate = (dir: -1 | 1) => {
    if (mode === "month")
      setAnchor(dir === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1));
    else setAnchor(dir === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1));
  };

  const headerLabel =
    mode === "month"
      ? format(anchor, "MMMM yyyy")
      : `${format(grid[0], "MMM d")} - ${format(grid[6], "MMM d, yyyy")}`;

  return (
    <div className="view-page">
      <PageHeader
        title="Calendar"
        subtitle="Month and week"
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary rounded-xl px-4 py-2 text-sm"
          >
            + Add
          </button>
        }
      />

      <div className="flex gap-2">
        {(["month", "week"] as const).map((m) => (
          <FilterPill key={m} active={mode === m} onClick={() => setMode(m)}>
            {m === "month" ? "Month" : "Week"}
          </FilterPill>
        ))}
      </div>

      <div className="glass-card flex items-center justify-between rounded-2xl px-3 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-muted px-2"
        >
          ‹
        </button>
        <span className="text-sm font-semibold">{headerLabel}</span>
        <button
          type="button"
          onClick={() => navigate(1)}
          className="text-muted px-2"
        >
          ›
        </button>
      </div>

      <div className="text-muted mb-2 grid grid-cols-7 text-center text-[10px] font-medium">
        {(weekStartsOnMonday
          ? ["M", "T", "W", "T", "F", "S", "S"]
          : ["S", "M", "T", "W", "T", "F", "S"]
        ).map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {grid.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEntries = calendarIndex.get(key) ?? [];
          const selected = selectedDay && isSameDay(day, selectedDay);
          const inMonth = mode === "week" || isSameMonth(day, anchor);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`relative aspect-square rounded-xl text-sm transition-colors ${
                selected
                  ? "bg-block text-white font-semibold"
                  : inMonth
                    ? "text-primary hover:bg-paper"
                    : "text-muted"
              } ${isToday && !selected ? "ring-block/45 font-semibold ring-1" : ""}`}
            >
              {format(day, "d")}
              {dayEntries.length > 0 && (
                <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {dayEntries.slice(0, 3).map((entry) => (
                    <span
                      key={`${entry.item.id}-${entry.kind}`}
                      className="h-1 w-1 rounded-full"
                      style={{
                        backgroundColor:
                          entry.kind === "gpd"
                            ? "#a855f7"
                            : entry.kind === "check-back"
                              ? "#f97316"
                              : (getCategory(entry.item.categoryId)?.color ??
                                "#64748b"),
                      }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <section className="section-block">
          <h2 className="text-muted text-sm font-semibold">
            {format(selectedDay, "EEEE, MMM d")}
          </h2>
          {selectedEntries.length === 0 ? (
            <p className="text-muted text-sm">Nothing scheduled</p>
          ) : (
            <div className="item-list">
              {selectedEntries.map((entry) => (
                <CalendarDayItem
                  key={`${entry.item.id}-${entry.kind}`}
                  entry={entry}
                  category={getCategory(entry.item.categoryId)}
                  onDone={() => markDone(entry.item)}
                  onSnooze={() => setSnoozeItem(entry.item)}
                  onEdit={() => setEditItem(entry.item)}
                  onDelete={() =>
                    deleteWithUndo(entry.item, deleteItem, restoreItem)
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {(showForm || editItem) && (
        <ItemForm
          categories={categories}
          item={editItem}
          defaultDueDate={
            !editItem && selectedDay
              ? format(selectedDay, "yyyy-MM-dd")
              : undefined
          }
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          onSave={async (data) => {
            if (editItem) await updateItem(editItem.id, data);
            else await addItem(data);
            setShowForm(false);
            setEditItem(null);
          }}
        />
      )}

      {snoozeItem && (
        <SnoozeSheet
          isSnoozed={snoozeItem.status === "snoozed"}
          onClose={() => setSnoozeItem(null)}
          onWakeNow={
            snoozeItem.status === "snoozed"
              ? async () => {
                  await unsnooze(snoozeItem);
                  setSnoozeItem(null);
                }
              : undefined
          }
          onSelect={async (date) => {
            await snooze(snoozeItem, date);
            setSnoozeItem(null);
          }}
        />
      )}
    </div>
  );
}

function CalendarDayItem({
  entry,
  category,
  onDone,
  onSnooze,
  onEdit,
  onDelete,
}: {
  entry: CalendarEntry;
  category?: Category;
  onDone: () => void;
  onSnooze: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      {entry.label && (
        <p className="text-muted mb-0.5 text-[10px] font-medium uppercase">
          {entry.label}
        </p>
      )}
      <SwipeItem
        item={entry.item}
        category={category}
        onDone={onDone}
        onSnooze={onSnooze}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
