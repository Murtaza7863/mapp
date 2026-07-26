import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { ParseDumpResult } from "../lib/brain-dump/types";
import type { FeedEntry, FeedFocus } from "../lib/feed";
import type { Item } from "../types";

import { EventDeadlinesSection } from "../components/EventDeadlinesSection";
import { DailyBriefingCard } from "../components/DailyBriefingCard";
import { StarIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { LoadingView } from "../components/LoadingView";
import { MomentumBar } from "../components/MomentumBar";
import { NudgeQueue } from "../components/NudgeQueue";
import { PlotBar } from "../components/PlotBar";
import { QuickAddBar } from "../components/QuickAddBar";
import { SwipeItem } from "../components/SwipeItem";
import { ThreadActions } from "../components/ThreadActions";
import { TodayStats } from "../components/TodayStats";
import { TriageSession } from "../components/TriageSession";
import { WrapUpSheet, tomorrowMorning } from "../components/WrapUpSheet";
import {
  EmptyState,
  FilterPill,
  PageHeader,
  SectionHeader,
} from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useCompletions, useItems } from "../hooks/useItems";
import { useToast } from "../hooks/useToast";
import { useUndo } from "../hooks/useUndo";
import { applyProposals } from "../lib/brain-dump/apply-proposals";
import { applyThreadActionToItems } from "../lib/batch-threads";
import { computeDailyBriefing } from "../lib/briefing";
import { buildEventDeadlineEntries } from "../lib/event-deadlines";
import {
  buildCommandFeed,
  BUCKET_LABELS,
  filterFeedByCategory,
  filterFeedByFocus,
  groupFeedByArea,
  groupFeedByBucket,
} from "../lib/feed";
import { buildSuggestions } from "../lib/pipeline";
import { setLastCategoryId } from "../lib/preferences";
import { computeTodaySummary } from "../lib/stats";
import { findQuickAction } from "../lib/thread-actions";
import { findTriageCandidates } from "../lib/triage";
import { computeMomentum } from "../lib/momentum";
import { computeWrapUpSummary, isWrapUpTime } from "../lib/wrapup";

type ViewMode = "feed" | "areas";

export function TodayView() {
  const {
    items,
    itemsLoading,
    addItem,
    updateItem,
    updateItems,
    deleteItem,
    restoreItem,
    markDone,
    snooze,
    unsnooze,
  } = useItems();
  const { completions } = useCompletions();
  const { categories, getCategory, addCategory } = useCategories();
  const { deleteWithUndo } = useUndo();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);
  const [feedFocus, setFeedFocus] = useState<FeedFocus | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageQueue, setTriageQueue] = useState<Item[]>([]);
  const [plotPasteText, setPlotPasteText] = useState<string | undefined>();

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
  const briefing = useMemo(() => computeDailyBriefing(items), [items]);
  const wrapUp = useMemo(
    () => computeWrapUpSummary(items, completions),
    [items, completions],
  );
  const momentum = useMemo(
    () => computeMomentum(items, completions),
    [items, completions],
  );
  const suggestions = useMemo(() => buildSuggestions(items), [items]);
  const fullFeed = useMemo(() => buildCommandFeed(items), [items]);
  const feed = useMemo(() => {
    const byFocus = filterFeedByFocus(fullFeed, feedFocus);
    return filterFeedByCategory(byFocus, areaFilter);
  }, [fullFeed, feedFocus, areaFilter]);

  const hasNudgesInFeed = useMemo(
    () => feed.some((e) => e.bucket === "chase"),
    [feed],
  );

  const chaseMode = feedFocus === "chase";

  const openTriage = () => {
    setTriageQueue(findTriageCandidates(items));
    setTriageOpen(true);
  };

  const bulkBumpChase = async () => {
    const chaseItems = feed
      .filter((e) => e.bucket === "chase")
      .map((e) => e.item);
    const action = findQuickAction("Bump sent");
    if (!action || chaseItems.length === 0) return;
    const updates = applyThreadActionToItems(chaseItems, action);
    await updateItems(updates);
    toast(`Bumped ${updates.length} thread${updates.length === 1 ? "" : "s"}`, {
      kind: "success",
    });
  };

  const parkForTomorrow = async () => {
    const when = tomorrowMorning();
    for (const item of wrapUp.parkable) {
      await snooze(item, when);
    }
    setWrapUpOpen(false);
    toast(`Parked ${wrapUp.parkable.length} for tomorrow`, { kind: "success" });
  };

  const byArea = useMemo(
    () =>
      groupFeedByArea(feed, (id) => getCategory(id)?.name ?? "Uncategorized"),
    [feed, getCategory],
  );

  const byBucket = useMemo(() => groupFeedByBucket(feed), [feed]);

  const deepLinkId = searchParams.get("item");
  const focusParam = searchParams.get("focus");

  useEffect(() => {
    if (
      focusParam === "chase" ||
      focusParam === "prep" ||
      focusParam === "overdue"
    ) {
      setFeedFocus(focusParam);
    }
    if (searchParams.get("wrapup") === "1") setWrapUpOpen(true);
  }, [focusParam, searchParams]);

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
      const applied = await applyProposals(result.items, categories, addItem, {
        actions: result.actions,
        addCategory,
        existingItems: items,
      });
      const total =
        applied.items.length +
        applied.foldersCreated +
        applied.areasCreated;
      if (total === 0) return;
      if (applied.items[0]?.categoryId) {
        setLastCategoryId(applied.items[0].categoryId);
      }
      const parts: string[] = [];
      if (applied.foldersCreated > 0) {
        parts.push(
          `${applied.foldersCreated} folder${applied.foldersCreated === 1 ? "" : "s"}`,
        );
      }
      if (applied.areasCreated > 0) {
        parts.push(
          `${applied.areasCreated} area${applied.areasCreated === 1 ? "" : "s"}`,
        );
      }
      if (applied.items.length > 0) {
        parts.push(
          `${applied.items.length} item${applied.items.length === 1 ? "" : "s"}`,
        );
      }
      toast(`Plotted ${parts.join(" + ")}`, { kind: "success" });
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
    const { item, reason } = entry;
    const isThread = item.type === "follow-up";

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
        {isThread && (
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
            : feedFocus || areaFilter
              ? `${feed.length} focused · ${fullFeed.length} active`
              : `${fullFeed.length} active`
        }
        showDate
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary min-h-[44px] shrink-0 rounded-lg px-4 py-2 text-sm"
          >
            + Add
          </button>
        }
      />

      <DailyBriefingCard
        briefing={briefing}
        onFocusNudge={() => setFeedFocus("chase")}
        onFocusOverdue={() => setFeedFocus("overdue")}
        onFocusPrep={() => setFeedFocus("prep")}
        onWrapUp={() => setWrapUpOpen(true)}
        showWrapUp={isWrapUpTime()}
      />

      <MomentumBar momentum={momentum} />

      <TodayStats
        summary={summary}
        focus={feedFocus}
        areaFilter={areaFilter}
        onFocusChange={setFeedFocus}
        onAreaFilterChange={setAreaFilter}
        onTriage={openTriage}
      />

      {summary.triage > 0 && !triageOpen && (
        <button
          type="button"
          onClick={openTriage}
          className="home-threads-banner w-full text-left"
          style={{
            borderColor: "rgba(251, 146, 60, 0.25)",
            background: "rgba(251, 146, 60, 0.08)",
            color: "#fdba74",
          }}
        >
          <span>
            {summary.triage} new capture{summary.triage === 1 ? "" : "s"} need a
            date
          </span>
          <span className="home-threads-banner-cta" style={{ color: "#fb923c" }}>
            Triage →
          </span>
        </button>
      )}

      {summary.needsNudge > 0 && !hasNudgesInFeed && !chaseMode && (
        <button
          type="button"
          onClick={() => setFeedFocus("chase")}
          className="home-threads-banner w-full text-left"
        >
          <span>
            {summary.needsNudge} thread{summary.needsNudge === 1 ? "" : "s"} need
            a nudge
          </span>
          <span className="home-threads-banner-cta">Work nudges →</span>
        </button>
      )}

      {!chaseMode && suggestions.length > 0 && (
        <NudgeQueue
          suggestions={suggestions}
          items={items}
          onSelect={(id) => {
            const item = items.find((i) => i.id === id);
            if (item) setEditItem(item);
          }}
          onUpdate={(id, changes) => {
            void updateItem(id, changes).catch(actionError);
          }}
        />
      )}

      <QuickAddBar
        categories={categories}
        onPasteToPlot={(text) => setPlotPasteText(text)}
        onAdd={async (data) => {
          const created = await addItem(data);
          if (created.categoryId) setLastCategoryId(created.categoryId);
          toast("Added", { kind: "success" });
        }}
      />

      <PlotBar
        categories={categories}
        initialText={plotPasteText}
        onParsed={handlePlot}
      />

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
          active={viewMode === "feed" && feedFocus === null && !areaFilter}
          onClick={() => {
            setViewMode("feed");
            setFeedFocus(null);
            setAreaFilter(null);
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
          active={feedFocus === "prep"}
          onClick={() => setFeedFocus((f) => (f === "prep" ? null : "prep"))}
        >
          Prep
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
          description="Quick add, Plot something, or tap + Add to get started"
        />
      ) : feed.length === 0 ? (
        <EmptyState
          title="Nothing in this focus"
          description="Tap All active or clear summary filters"
        />
      ) : chaseMode ? (
        <div className="page-block">
          <SectionHeader
            title="Nudge session"
            count={feed.length}
            action={
              <div className="flex items-center gap-2">
                {feed.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void bulkBumpChase()}
                    className="text-violet-300 text-[11px] font-medium"
                  >
                    Bump all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFeedFocus(null)}
                  className="text-zinc-500 text-[11px] font-medium"
                >
                  Exit
                </button>
              </div>
            }
          />
          {feed.length === 0 ? (
            <EmptyState
              title="No nudges right now"
              description="Threads will resurface here when they need follow-through"
            />
          ) : (
            <div className="item-list">
              {feed.map((entry) => renderEntry(entry))}
            </div>
          )}
        </div>
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

      {wrapUpOpen && (
        <WrapUpSheet
          summary={wrapUp}
          onClose={() => setWrapUpOpen(false)}
          onParkForTomorrow={() => void parkForTomorrow()}
          onOpenNudges={() => {
            setWrapUpOpen(false);
            setFeedFocus("chase");
          }}
        />
      )}

      {triageOpen && (
        <TriageSession
          items={triageQueue}
          onSchedule={async (item, dueAt) => {
            await updateItem(item.id, { dueAt: dueAt.toISOString() });
            setTriageQueue((q) => q.filter((i) => i.id !== item.id));
          }}
          onDelete={async (item) => {
            await deleteItem(item.id);
            setTriageQueue((q) => q.filter((i) => i.id !== item.id));
          }}
          onClose={() => setTriageOpen(false)}
        />
      )}
    </div>
  );
}
