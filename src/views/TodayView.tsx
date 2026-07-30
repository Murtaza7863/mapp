import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { ParseDumpResult } from "../lib/brain-dump/types";
import type { FeedEntry, FeedFocus } from "../lib/feed";
import type { Item } from "../types";

import { AiBriefingCard } from "../components/AiBriefingCard";
import { EventDeadlinesSection } from "../components/EventDeadlinesSection";
import { StarIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { LoadingView } from "../components/LoadingView";
import { PlotBar } from "../components/PlotBar";
import { StatusLine } from "../components/StatusLine";
import { SwipeItem } from "../components/SwipeItem";
import { TriageSession } from "../components/TriageSession";
import { EmptyState, FilterPill, SectionHeader } from "../components/ui";
import { WrapUpSheet, tomorrowMorning } from "../components/WrapUpSheet";
import { useCategories } from "../hooks/useCategories";
import { useCompletions, useItems } from "../hooks/useItems";
import { useToast } from "../hooks/useToast";
import { useUndo } from "../hooks/useUndo";
import { applyThreadActionToItems } from "../lib/batch-threads";
import { applyProposals } from "../lib/brain-dump/apply-proposals";
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
import { computeMomentum } from "../lib/momentum";
import { setLastCategoryId } from "../lib/preferences";
import { computeTodaySummary } from "../lib/stats";
import { findQuickAction } from "../lib/thread-actions";
import { findTriageCandidates } from "../lib/triage";
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
    deleteItemCascade,
    restoreItem,
    markDone,
    snooze,
    unsnooze,
    reopen,
  } = useItems();
  const { completions } = useCompletions();
  const {
    categories,
    getCategory,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();
  const { deleteWithUndo } = useUndo();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);
  const [feedFocus, setFeedFocus] = useState<FeedFocus | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageQueue, setTriageQueue] = useState<Item[]>([]);

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
  const fullFeed = useMemo(() => buildCommandFeed(items), [items]);
  const feed = useMemo(() => {
    const byFocus = filterFeedByFocus(fullFeed, feedFocus);
    return filterFeedByCategory(byFocus, areaFilter);
  }, [fullFeed, feedFocus, areaFilter]);

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
    toast(
      `Bumped ${updates.length} follow-up${updates.length === 1 ? "" : "s"}`,
      {
        kind: "success",
      },
    );
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
  const areaParam = searchParams.get("area");

  useEffect(() => {
    if (
      focusParam === "chase" ||
      focusParam === "prep" ||
      focusParam === "overdue" ||
      focusParam === "priority" ||
      focusParam === "today" ||
      focusParam === "routine" ||
      focusParam === "snoozed" ||
      focusParam === "follow-up"
    ) {
      setFeedFocus(focusParam);
    }
    if (areaParam) setAreaFilter(areaParam);
    if (searchParams.get("wrapup") === "1") setWrapUpOpen(true);
  }, [focusParam, areaParam, searchParams]);

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
      const applied = await applyProposals(
        result.items,
        {
          categories: [...categories],
          items: [...items],
          addItem,
          addCategory,
          updateCategory,
          deleteCategory,
          markDone,
          snooze,
          unsnooze,
          deleteItem,
          deleteItemCascade,
          updateItem,
          updateItems,
          reopen,
          completions,
          navigate: (to) => {
            navigate(to);
          },
          openSheet: (sheet) => {
            if (sheet === "wrapup") setWrapUpOpen(true);
            if (sheet === "triage") openTriage();
          },
          updateSettings: async (partial) => {
            const { updateSettings } = await import("../db");
            await updateSettings(partial);
          },
          exportData: async (categoryId) => {
            const { exportData, exportDataForCategory, downloadJson } =
              await import("../lib/export");
            const { updateSettings } = await import("../db");
            const data = categoryId
              ? await exportDataForCategory(categoryId)
              : await exportData();
            const slug = categoryId
              ? (categories.find((c) => c.id === categoryId)?.name ?? "area")
                  .toLowerCase()
                  .replace(/\s+/g, "-")
              : "backup";
            await downloadJson(
              data,
              `plotline-${slug}-${new Date().toISOString().slice(0, 10)}.json`,
            );
            if (!categoryId) {
              await updateSettings({
                lastManualBackupAt: new Date().toISOString(),
              });
            }
          },
          restoreBackup: async () => {
            const { restoreFromAutoBackup } =
              await import("../lib/persistence");
            await restoreFromAutoBackup();
          },
          syncSchedule: async () => {
            const { syncNotificationSchedule } =
              await import("../lib/notifications");
            await syncNotificationSchedule();
          },
        },
        { actions: result.actions },
      );
      const total =
        applied.items.length +
        applied.foldersCreated +
        applied.areasCreated +
        applied.completed +
        applied.snoozed +
        applied.unsnoozed +
        applied.deleted +
        applied.updated +
        applied.navigated +
        applied.reopened +
        applied.parked +
        applied.settingsUpdated +
        applied.exported +
        applied.bumped +
        applied.duplicated +
        applied.restored;
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
      if (applied.completed > 0) {
        parts.push(`${applied.completed} done`);
      }
      if (applied.reopened > 0) {
        parts.push(`${applied.reopened} reopened`);
      }
      if (applied.snoozed > 0) {
        parts.push(`${applied.snoozed} snoozed`);
      }
      if (applied.parked > 0) {
        parts.push(`${applied.parked} parked`);
      }
      if (applied.bumped > 0) {
        parts.push(`${applied.bumped} bumped`);
      }
      if (applied.duplicated > 0) {
        parts.push(`${applied.duplicated} copied`);
      }
      if (applied.restored > 0) {
        parts.push("restored");
      }
      if (applied.unsnoozed > 0) {
        parts.push(`${applied.unsnoozed} woken`);
      }
      if (applied.deleted > 0) {
        parts.push(`${applied.deleted} deleted`);
      }
      if (applied.updated > 0) {
        parts.push(`${applied.updated} updated`);
      }
      if (applied.settingsUpdated > 0) {
        parts.push("settings");
      }
      if (applied.exported > 0) {
        parts.push("exported");
      }
      if (applied.navigated > 0) {
        parts.push("opened");
      }
      toast(`Plotted ${parts.join(" · ")}`, { kind: "success" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not apply Plot", {
        kind: "error",
      });
      throw err;
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

    return (
      <SwipeItem
        key={item.id}
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
    );
  };

  return (
    <div className="view-page">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-muted text-xs sm:hidden">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <AiBriefingCard
        items={items}
        briefing={briefing}
        onFocusNudge={() => setFeedFocus("chase")}
        onFocusOverdue={() => setFeedFocus("overdue")}
        onFocusPrep={() => setFeedFocus("prep")}
        onWrapUp={() => setWrapUpOpen(true)}
        showWrapUp={isWrapUpTime()}
      />

      <PlotBar categories={categories} items={items} onParsed={handlePlot} />

      <StatusLine
        summary={summary}
        momentum={momentum}
        focus={feedFocus}
        onFocusChange={setFeedFocus}
        onTriage={openTriage}
        onWrapUp={() => setWrapUpOpen(true)}
        showWrapUp={isWrapUpTime()}
      />

      {summary.triage > 0 && !triageOpen && (
        <button
          type="button"
          onClick={openTriage}
          className="home-threads-banner w-full text-left"
        >
          <span>
            {summary.triage === 1
              ? "1 capture still needs a date"
              : `${summary.triage} captures still need a date`}
          </span>
          <span className="home-threads-banner-cta">Set dates →</span>
        </button>
      )}

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
        {chaseCount > 0 && (
          <FilterPill
            active={feedFocus === "chase"}
            onClick={() =>
              setFeedFocus((f) => (f === "chase" ? null : "chase"))
            }
          >
            Nudge · {chaseCount}
          </FilterPill>
        )}
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
      </div>

      {fullFeed.length === 0 && eventDeadlineCount === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="Use Plot above — add tasks, or try done:, snooze, open calendar…"
        />
      ) : feed.length === 0 ? (
        <EmptyState
          title="Nothing in this view"
          description="Clear filters to see everything active"
        />
      ) : chaseMode ? (
        <div className="page-block">
          <SectionHeader
            title="Nudges"
            count={feed.length}
            action={
              <div className="flex items-center gap-2">
                {feed.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void bulkBumpChase()}
                    className="text-block text-[11px] font-medium"
                  >
                    Bump all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFeedFocus(null)}
                  className="text-muted text-[11px] font-medium"
                >
                  Exit
                </button>
              </div>
            }
          />
          {feed.length === 0 ? (
            <EmptyState
              title="No nudges right now"
              description="Follow-ups show up here when it's time to ping someone"
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

      {editItem && (
        <ItemForm
          categories={categories}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={async (data) => {
            try {
              await updateItem(editItem.id, data);
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
