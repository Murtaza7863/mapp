import { useMemo, useState } from "react";

import type { Item } from "../types";

import { EventDeadlinesSection } from "../components/EventDeadlinesSection";
import { MountainIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SwipeItem } from "../components/SwipeItem";
import { ThreadActions } from "../components/ThreadActions";
import { EmptyState, PageHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import { buildEventDeadlineEntries } from "../lib/event-deadlines";

export function EventDeadlinesView() {
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
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);

  const entries = useMemo(() => buildEventDeadlineEntries(items), [items]);

  const threads = useMemo(
    () =>
      items.filter(
        (i) => i.type === "follow-up" && i.status !== "done" && i.linkedEventAt,
      ),
    [items],
  );

  return (
    <div className="view-page">
      <PageHeader
        title="Event prep"
        subtitle="Linked events with auto-calculated prep deadlines"
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary rounded-lg px-4 py-2 text-sm"
          >
            + Add
          </button>
        }
      />

      {entries.length === 0 && threads.length === 0 ? (
        <EmptyState
          icon={<MountainIcon className="h-5 w-5" />}
          title="No linked events"
          description="Add a follow-up with a linked event date — prep deadlines are calculated automatically (10 weeks before)."
        />
      ) : (
        <>
          <EventDeadlinesSection
            items={items}
            onSelect={(id) => {
              const item = items.find((i) => i.id === id);
              if (item) setEditItem(item);
            }}
          />

          {threads.length > 0 && (
            <section className="section-block">
              <h2 className="text-zinc-400 mb-2 text-xs font-semibold tracking-wide uppercase">
                All threads
              </h2>
              <div className="item-list">
                {threads.map((item) => (
                  <div key={item.id}>
                    <SwipeItem
                      item={item}
                      category={getCategory(item.categoryId)}
                      onDone={() => markDone(item)}
                      onSnooze={() => setSnoozeItem(item)}
                      onEdit={() => setEditItem(item)}
                      onDelete={() =>
                        deleteWithUndo(item, deleteItem, restoreItem)
                      }
                    />
                    <ThreadActions
                      item={item}
                      onUpdate={(changes) => updateItem(item.id, changes)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {(showForm || editItem) && (
        <ItemForm
          categories={categories}
          item={editItem}
          defaultType="follow-up"
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          onSave={async (data) => {
            const payload = { ...data, type: "follow-up" as const };
            if (editItem) await updateItem(editItem.id, payload);
            else await addItem(payload);
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
