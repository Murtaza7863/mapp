import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { Item, PipelineStage } from "../types";

import { CategoryIcon } from "../components/CategoryIcon";
import { ClockIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SwipeItem } from "../components/SwipeItem";
import { ThreadActions } from "../components/ThreadActions";
import {
  EmptyState,
  FilterPill,
  PageHeader,
  SectionHeader,
} from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import {
  filterStaleThreads,
  groupFollowUpsByStage,
  needsChase,
} from "../lib/pipeline";
import { PIPELINE_STAGE_LABELS } from "../types";

const STAGE_ORDER: (PipelineStage | "unset")[] = [
  "my_turn",
  "scheduling",
  "waiting",
  "outreach",
  "deferred",
  "unset",
];

export function FollowUpsView() {
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
  const { deleteWithUndo } = useUndo();
  const { categories, getCategory } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [nudgeOnly, setNudgeOnly] = useState(false);

  const threads = useMemo(() => {
    let list = items.filter(
      (i) => i.type === "follow-up" && i.status !== "done",
    );
    if (areaFilter !== "all") {
      list = list.filter((i) => i.categoryId === areaFilter);
    }
    if (staleOnly) list = filterStaleThreads(list);
    if (nudgeOnly) list = list.filter((i) => needsChase(i));
    return list;
  }, [items, areaFilter, staleOnly, nudgeOnly]);

  const byStage = useMemo(() => {
    const map = groupFollowUpsByStage(threads);
    return map;
  }, [threads]);

  const total = threads.length;
  const nudgeCount = useMemo(
    () =>
      items.filter(
        (i) => i.type === "follow-up" && i.status !== "done" && needsChase(i),
      ).length,
    [items],
  );
  const staleCount = useMemo(
    () =>
      filterStaleThreads(
        items.filter((i) => i.type === "follow-up" && i.status !== "done"),
      ).length,
    [items],
  );

  const deepLinkId = searchParams.get("item");
  useEffect(() => {
    if (!deepLinkId) return;
    const linked = items.find((i) => i.id === deepLinkId);
    if (linked) setEditItem(linked);
    setSearchParams({}, { replace: true });
  }, [deepLinkId, items, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("stale") === "1") setStaleOnly(true);
    if (searchParams.get("nudge") === "1") setNudgeOnly(true);
  }, [searchParams]);

  const renderList = (list: Item[]) => (
    <div>
      {list.map((item) => (
        <div key={item.id} className="thread-row">
          <SwipeItem
            item={item}
            category={getCategory(item.categoryId)}
            showType
            onDone={() => markDone(item)}
            onSnooze={() => setSnoozeItem(item)}
            onEdit={() => setEditItem(item)}
            onDelete={() => deleteWithUndo(item, deleteItem, restoreItem)}
          />
          <ThreadActions
            item={item}
            onUpdate={(changes) => updateItem(item.id, changes)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="view-page">
      <PageHeader
        title="Threads"
        subtitle="Outreach, waiting, revisit later"
        action={
          <div className="flex shrink-0 gap-2">
            {nudgeCount > 0 && (
              <Link
                to="/?focus=chase"
                className="border-violet-500/30 text-violet-300 min-h-[44px] rounded-lg border px-3 py-2 text-sm"
              >
                Nudge ({nudgeCount})
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm"
            >
              + Add
            </button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <FilterPill
          active={areaFilter === "all"}
          onClick={() => setAreaFilter("all")}
        >
          All areas
        </FilterPill>
        {categories.map((cat) => (
          <FilterPill
            key={cat.id}
            active={areaFilter === cat.id}
            onClick={() => setAreaFilter(cat.id)}
          >
            <span className="inline-flex items-center gap-1">
              <CategoryIcon category={cat} className="h-3 w-3" />
              {cat.name}
            </span>
          </FilterPill>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill active={!staleOnly && !nudgeOnly} onClick={() => {
          setStaleOnly(false);
          setNudgeOnly(false);
        }}>
          All threads
        </FilterPill>
        <FilterPill active={nudgeOnly} onClick={() => {
          setNudgeOnly(true);
          setStaleOnly(false);
        }}>
          Need nudge ({nudgeCount})
        </FilterPill>
        <FilterPill active={staleOnly} onClick={() => {
          setStaleOnly(true);
          setNudgeOnly(false);
        }}>
          Stale ({staleCount})
        </FilterPill>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<ClockIcon className="h-5 w-5" />}
          title={staleOnly ? "No stale threads" : "No open threads"}
          description="Track follow-up threads, outreach, and look-back-later items"
        />
      ) : (
        STAGE_ORDER.map((stage) => {
          const list = byStage.get(stage) ?? [];
          if (list.length === 0) return null;
          const title =
            stage === "unset"
              ? "Unsorted"
              : PIPELINE_STAGE_LABELS[stage as PipelineStage];
          return (
            <section key={stage} className="section-block">
              <SectionHeader title={title} count={list.length} />
              {renderList(list)}
            </section>
          );
        })
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
