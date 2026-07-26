import { useMemo, useState } from "react";

import type { Item } from "../types";

import { SearchIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SwipeItem } from "../components/SwipeItem";
import { EmptyState, PageHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import { searchItems } from "../lib/search";
import { ITEM_TYPE_LABELS } from "../types";

export function SearchView() {
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
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<Item["type"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Item["status"] | "all">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);

  const results = useMemo(
    () =>
      searchItems(items, {
        query,
        type: typeFilter,
        status: statusFilter,
        categoryId: categoryFilter,
      }),
    [items, query, typeFilter, statusFilter, categoryFilter],
  );

  const handleDelete = (item: Item) =>
    deleteWithUndo(item, deleteItem, restoreItem);

  return (
    <div>
      <PageHeader
        title="Search"
        subtitle="Title, notes, next action, contacts"
      />

      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search title, notes, next action…"
        className="input-field mb-3 w-full rounded-2xl px-4 py-3.5"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as Item["type"] | "all")
          }
          className="border-zinc-800 bg-zinc-900 text-zinc-200 rounded-lg border px-2 py-1.5 text-xs"
        >
          <option value="all">All types</option>
          {(Object.keys(ITEM_TYPE_LABELS) as Item["type"][]).map((t) => (
            <option key={t} value={t}>
              {ITEM_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as Item["status"] | "all")
          }
          className="border-zinc-800 bg-zinc-900 text-zinc-200 rounded-lg border px-2 py-1.5 text-xs"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="snoozed">Snoozed</option>
          <option value="done">Done</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border-zinc-800 bg-zinc-900 text-zinc-200 rounded-lg border px-2 py-1.5 text-xs"
        >
          <option value="all">All areas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-zinc-500 mb-3 text-xs">
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-5 w-5" />}
          title={
            query || typeFilter !== "all" || statusFilter !== "all"
              ? "No matches"
              : "Search"
          }
          description={
            query || typeFilter !== "all" || statusFilter !== "all"
              ? undefined
              : "Type to filter your items"
          }
        />
      ) : (
        <div className="space-y-2">
          {results.map((item) => (
            <SwipeItem
              key={item.id}
              item={item}
              category={getCategory(item.categoryId)}
              onDone={() => markDone(item)}
              onSnooze={() => setSnoozeItem(item)}
              onEdit={() => setEditItem(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="border-zinc-800 text-zinc-400 mt-4 w-full rounded-xl border border-dashed py-3"
      >
        + Add item
      </button>

      {(showForm || editItem) && (
        <ItemForm
          categories={categories}
          item={editItem}
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
