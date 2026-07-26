import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { Item } from "../types";

import { CategoryIcon } from "../components/CategoryIcon";
import { SearchIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SwipeItem } from "../components/SwipeItem";
import { EmptyState, FilterPill, PageHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import { searchItems } from "../lib/search";
import { ITEM_TYPE_LABELS } from "../types";

const STATUS_OPTIONS: Array<Item["status"] | "all"> = [
  "all",
  "pending",
  "snoozed",
  "done",
];

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
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<Item["type"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Item["status"] | "all">(
    () => {
      const fromUrl = searchParams.get("status");
      if (
        fromUrl === "pending" ||
        fromUrl === "snoozed" ||
        fromUrl === "done"
      ) {
        return fromUrl;
      }
      return "pending";
    },
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("status");
    if (
      fromUrl === "pending" ||
      fromUrl === "snoozed" ||
      fromUrl === "done" ||
      fromUrl === "all"
    ) {
      setStatusFilter(fromUrl);
    }
  }, [searchParams]);

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

      <div className="mb-2 flex flex-wrap gap-2">
        <FilterPill
          active={typeFilter === "all"}
          onClick={() => setTypeFilter("all")}
        >
          All types
        </FilterPill>
        {(Object.keys(ITEM_TYPE_LABELS) as Item["type"][]).map((t) => (
          <FilterPill
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
          >
            {ITEM_TYPE_LABELS[t]}
          </FilterPill>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => (
          <FilterPill
            key={status}
            active={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all"
              ? "All statuses"
              : status.charAt(0).toUpperCase() + status.slice(1)}
          </FilterPill>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        >
          All areas
        </FilterPill>
        {categories.map((c) => (
          <FilterPill
            key={c.id}
            active={categoryFilter === c.id}
            onClick={() => setCategoryFilter(c.id)}
          >
            <span className="inline-flex items-center gap-1">
              <CategoryIcon category={c} className="h-3 w-3" />
              {c.name}
            </span>
          </FilterPill>
        ))}
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
