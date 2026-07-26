import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { ParseDumpResult } from "../lib/brain-dump/types";
import type { FeedEntry, FeedFocus } from "../lib/feed";
import type { Item } from "../types";

import { EventDeadlinesSection } from "../components/EventDeadlinesSection";
import { StarIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { LoadingView } from "../components/LoadingView";
import { PlotBar } from "../components/PlotBar";
import { SwipeItem } from "../components/SwipeItem";
import { ThreadActions } from "../components/ThreadActions";
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
import { applyProposals } from "../lib/brain-dump/apply-proposals";
import { buildEventDeadlineEntries } from "../lib/event-deadlines";
import {
  buildCommandFeed,
  BUCKET_LABELS,
  filterFeedByFocus,
  groupFeedByArea,
  groupFeedByBucket,
} from "../lib/feed";
import { setLastCategoryId } from "../lib/preferences";
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
  const [feedFocus, setFeedFocus] = useState<FeedFocus | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");

  const folderNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) {
      if (i.type === "project") map.set(i.id, i.title);
    }
    return map;
  }, [items]);

  const summary = useMemo(
    () => computeTodaySummary(items, categories),
    [items, categories],
  );
  const fullFeed = useMemo(() => buildCommandFeed(items), [items]);
  const feed = useMemo(
    () => filterFeedByFocus(fullFeed, feedFocus),
    [fullFeed, feedFocus],
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

  const eventDeadlineCount = useMemo(
    () => buildEventDeadlineEntries(items).length,
    [items],
  );

  const chaseCount = useMemo(
    () => fullFeed.filter((e) => e.bucket === "chase").length,
    [fullFeed],
  );

  const handlePlot = async (result: ParseDumpResult) => {
    try {
      const created = await applyProposals(result.items, categories, addItem);
      if (created.length === 0) return;
      if (created[0]?.categoryId) setLastCategoryId(created[0].categoryId);
      toast(
        `Plotted ${created.length} item${created.length === 1 ? "" : "s"}`,
        { kind: "success" },
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save items", {
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

  const renderEntry = (entry: FeedEntry) => {
    const { item, reason, bucket } = entry;
    return (
      <div key={item.id}>
        <SwipeItem
          item={item}
          category={getCategory(item.categoryId)}
          parentFolderName={
            item.parentId ? folderNames.get(item.parentId) : undefined
          }
          reason={reason}
          showType
          onDone={() => handlers.onDone(item)}
          onSnooze={() => handlers.onSnooze(item)}
          onEdit={() => handlers.onEdit(item)}
          onDelete={() => handlers.onDelete(item)}
        />
        {bucket === "chase" && (
          <ThreadActions
            item={item}
            onUpdate={(changes) => {
              void updateItem(item.id, changes).catch(actionError);
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="view-page">
      <PageHeader
        title="Command center"
        subtitle={
          fullFeed.length === 0
            ? "Nothing active"
            : feedFocus
              ? `${feed.length} focused · ${fullFeed.length} active`
              : `${fullFeed.length} active`
        }
        showDate
      />

      <TodayStats
        summary={summary}
        focus={feedFocus}
        onFocusChange={setFeedFocus}
      />

      <PlotBar categories={categories} onParsed={handlePlot} />

      <EventDeadlinesSection
        items={items}
        compact
        onSelect={(id) => {
          const item = items.find((i) => i.id === id);
          if (item) setEditItem(item);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          active={viewMode === "feed" && feedFocus === null}
          onClick={() => {
            setViewMode("feed");
            setFeedFocus(null);
          }}
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
          active={feedFocus === "chase"}
          onClick={() =>
            setFeedFocus((f) => (f === "chase" ? null : "chase"))
          }
        >
          Nudge{chaseCount > 0 ? ` · ${chaseCount}` : ""}
        </FilterPill>
        <FilterPill
          active={feedFocus === "priority"}
          onClick={() =>
            setFeedFocus((f) => (f === "priority" ? null : "priority"))
          }
        >
          <span className="inline-flex items-center gap-1">
            <StarIcon filled className="h-3 w-3" />
            Priority
          </span>
        </FilterPill>
        {chaseCount > 0 && (
          <Link
            to="/follow-ups"
            className="text-zinc-500 ml-auto text-[11px] font-medium"
          >
            All threads
          </Link>
        )}
      </div>

      {fullFeed.length === 0 && eventDeadlineCount === 0 ? (
        <EmptyState
          title="Clear"
          description="Plot something above to get started"
        />
      ) : feed.length === 0 ? (
        <EmptyState
          title="Nothing in this focus"
          description="Tap All active or another summary chip"
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
                  {entries.map((entry) => renderEntry(entry))}
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
                {entries.map((entry) => renderEntry(entry))}
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
