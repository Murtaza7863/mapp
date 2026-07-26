import { useMemo, useState } from "react";

import type { Item } from "../types";

import { ClimbSection } from "../components/ClimbSection";
import { MountainIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SwipeItem } from "../components/SwipeItem";
import { ThreadActions } from "../components/ThreadActions";
import { EmptyState, PageHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import { buildClimbEntries, getClimbCategoryId } from "../lib/climb";

export function ClimbView() {
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

  const climbId = getClimbCategoryId(categories);
  const entries = useMemo(
    () => buildClimbEntries(items, climbId),
    [items, climbId],
  );

  const threads = useMemo(
    () =>
      items.filter(
        (i) =>
          i.categoryId === climbId &&
          i.type === "follow-up" &&
          i.status !== "done",
      ),
    [items, climbId],
  );

  return (
    <div className="view-page">
      <PageHeader
        title="CLIMB"
        subtitle="Events, GPD deadlines, submissions"
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
          title="No CLIMB threads"
          description="Add a follow-up with a linked event date — GPD due dates are calculated automatically (10 weeks before)."
        />
      ) : (
        <>
          <ClimbSection
            items={items}
            categories={categories}
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
          defaultCategoryId={climbId}
          lockCategoryId={editItem ? undefined : climbId}
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
