import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { ParsedQuickAdd } from "../lib/quickadd";
import type { Item } from "../types";

import { ClimbSection } from "../components/ClimbSection";
import { StarIcon } from "../components/icons";
import { QuickAdd, ItemForm, SnoozeSheet } from "../components/ItemForm";
import { LoadingView } from "../components/LoadingView";
import { SuggestionStrip } from "../components/SuggestionStrip";
import { SwipeItem } from "../components/SwipeItem";
import { TodayStats } from "../components/TodayStats";
import {
  EmptyState,
  FilterPill,
  PageHeader,
  SectionHeader,
} from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useToast } from "../hooks/useToast";
import { useUndo } from "../hooks/useUndo";
import { buildClimbEntries, getClimbCategoryId } from "../lib/climb";
import {
  buildCommandFeed,
  BUCKET_LABELS,
  groupFeedByArea,
  groupFeedByBucket,
} from "../lib/feed";
import { buildSuggestions } from "../lib/pipeline";
import { setLastCategoryId } from "../lib/preferences";
import { applyQuickAdd } from "../lib/quickadd-actions";
import { computeTodaySummary } from "../lib/stats";

type ViewMode = "feed" | "areas";

export function TodayView() {
  const {
    items,
    itemsLoading,
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
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");

  const folderNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) {
      if (i.type === "project") map.set(i.id, i.title);
    }
    return map;
  }, [items]);

  const suggestions = useMemo(() => buildSuggestions(items), [items]);
  const summary = useMemo(
    () => computeTodaySummary(items, categories),
    [items, categories],
  );
  const feed = useMemo(
    () => buildCommandFeed(items, { priorityOnly }),
    [items, priorityOnly],
  );

  const byArea = useMemo(
    () =>
      groupFeedByArea(feed, (id) => getCategory(id)?.name ?? "Uncategorized"),
    [feed, getCategory],
  );

  const byBucket = useMemo(() => groupFeedByBucket(feed), [feed]);

  const deepLinkId = searchParams.get("item");

  useEffect(() => {
    if (!deepLinkId) return;
    const linked = items.find((i) => i.id === deepLinkId);
    if (linked) setEditItem(linked);
    setSearchParams({}, { replace: true });
  }, [deepLinkId, items, setSearchParams]);

  const climbCount = useMemo(() => {
    const climbId = getClimbCategoryId(categories);
    return buildClimbEntries(items, climbId).length;
  }, [items, categories]);

  const handleQuickAdd = async (parsed: ParsedQuickAdd) => {
    try {
      const created = await applyQuickAdd(parsed, {
        categories,
        items,
        addItem,
      });
      if (created.categoryId) setLastCategoryId(created.categoryId);
      const area = getCategory(created.categoryId)?.name ?? "Home";
      toast(`Added to ${area}`, {
        kind: "success",
        action: {
          label: "Undo",
          onClick: () => {
            void deleteItem(created.id);
          },
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add item", {
        kind: "error",
      });
    }
  };

  const actionError = (err: unknown) =>
    toast(err instanceof Error ? err.message : "Something went wrong", {
      kind: "error",
    });

  const handlers = {
    onDone: (item: Item) => void markDone(item).catch(actionError),
    onSnooze: (item: Item) => setSnoozeItem(item),
    onEdit: (item: Item) => setEditItem(item),
    onDelete: (item: Item) =>
      void deleteWithUndo(item, deleteItem, restoreItem).catch(actionError),
  };

  if (itemsLoading) {
    return (
      <div className="view-page">
        <LoadingView label="Loading tasks…" />
      </div>
    );
  }

  const renderItem = (item: Item) => (
    <SwipeItem
      key={item.id}
      item={item}
      category={getCategory(item.categoryId)}
      parentFolderName={
        item.parentId ? folderNames.get(item.parentId) : undefined
      }
      showType
      {...handlers}
      onDone={() => handlers.onDone(item)}
      onSnooze={() => handlers.onSnooze(item)}
      onEdit={() => handlers.onEdit(item)}
      onDelete={() => handlers.onDelete(item)}
    />
  );

  return (
    <div className="view-page">
      <PageHeader
        title="Command center"
        subtitle={
          feed.length + suggestions.length === 0
            ? "Nothing active"
            : `${feed.length + suggestions.length} active`
        }
        showDate
      />

      <TodayStats summary={summary} />

      <QuickAdd
        categories={categories}
        onAdd={handleQuickAdd}
        onExpand={() => setShowForm(true)}
      />

      <SuggestionStrip
        suggestions={suggestions}
        onSelect={(id) => {
          const item = items.find((i) => i.id === id);
          if (item) setEditItem(item);
        }}
      />

      <ClimbSection
        items={items}
        categories={categories}
        compact
        onSelect={(id) => {
          const item = items.find((i) => i.id === id);
          if (item) setEditItem(item);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <FilterPill
          active={viewMode === "feed"}
          onClick={() => setViewMode("feed")}
        >
          All active
        </FilterPill>
        <FilterPill
          active={viewMode === "areas"}
          onClick={() => setViewMode("areas")}
        >
          By area
        </FilterPill>
        <FilterPill
          active={priorityOnly}
          onClick={() => setPriorityOnly(!priorityOnly)}
        >
          <span className="inline-flex items-center gap-1">
            <StarIcon filled className="h-3 w-3" />
            Priority
          </span>
        </FilterPill>
      </div>

      {feed.length === 0 && suggestions.length === 0 && climbCount === 0 ? (
        <EmptyState
          title="Clear"
          description="Add something above to get started"
        />
      ) : viewMode === "feed" ? (
        <div className="page-block">
          {[...byBucket.entries()].map(([bucket, entries]) => {
            if (entries.length === 0) return null;
            return (
              <section key={bucket} className="section-block">
                <SectionHeader
                  title={BUCKET_LABELS[bucket]}
                  count={entries.length}
                />
                <div className="item-list">
                  {entries.map(({ item }) => renderItem(item))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="page-block">
          {[...byArea.entries()].map(([areaName, entries]) => (
            <section key={areaName} className="section-block">
              <SectionHeader title={areaName} count={entries.length} />
              <div className="item-list">
                {entries.map(({ item }) => renderItem(item))}
              </div>
            </section>
          ))}
        </div>
      )}

      {(showForm || editItem) && (
        <ItemForm
          categories={categories}
          item={editItem}
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          onSave={async (data) => {
            try {
              if (editItem) await updateItem(editItem.id, data);
              else {
                const created = await addItem(data);
                if (created.categoryId) setLastCategoryId(created.categoryId);
                toast("Task added", { kind: "success" });
              }
              setShowForm(false);
              setEditItem(null);
            } catch (err) {
              actionError(err);
              throw err;
            }
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
