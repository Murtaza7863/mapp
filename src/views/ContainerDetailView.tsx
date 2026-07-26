import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import type { Item } from "../types";

import { containerProgress } from "../components/ContainerCard";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SwipeItem } from "../components/SwipeItem";
import { EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import {
  categoryHasSubgroups,
  groupChildrenBySubgroup,
  subgroupSectionLabel,
} from "../lib/containers";
import {
  getChildren,
  getDoneChildren,
  nextChildSortOrder,
} from "../lib/projects";

interface LocationState {
  backTo?: string;
  backLabel?: string;
  areaId?: string;
}

export function ContainerDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? {};
  const backTo = state.backTo ?? "/categories";
  const backLabel = state.backLabel ?? "Areas";

  const {
    items,
    addItem,
    updateItem,
    deleteItem,
    deleteItemCascade,
    restoreItem,
    markDone,
    snooze,
    unsnooze,
  } = useItems();
  const { deleteWithUndo } = useUndo();
  const { categories, getCategory } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);
  const [defaultChildGroup, setDefaultChildGroup] = useState<
    string | undefined
  >();

  const parent = useMemo(
    () => items.find((i) => i.id === id && i.type === "project"),
    [items, id],
  );

  const category = useMemo(
    () => (parent ? getCategory(parent.categoryId) : undefined),
    [parent, getCategory],
  );

  const subgroups = category?.subgroups ?? [];
  const hasSubgroups = categoryHasSubgroups(category);

  const children = useMemo(
    () => (parent ? getChildren(items, parent.id) : []),
    [items, parent],
  );

  const progress = useMemo(
    () => (parent ? containerProgress(parent, items) : null),
    [parent, items],
  );

  const doneChildren = useMemo(
    () => (parent ? getDoneChildren(items, parent.id).slice(0, 8) : []),
    [items, parent],
  );

  const grouped = useMemo(() => {
    if (!hasSubgroups) return null;
    return groupChildrenBySubgroup(children, subgroups);
  }, [hasSubgroups, children, subgroups]);

  if (!parent) {
    return (
      <div className="view-page">
        <PageHeader title="Not found" subtitle="This folder was removed." />
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="btn-ghost rounded-xl px-4 py-2 text-sm"
        >
          Back to {backLabel}
        </button>
      </div>
    );
  }

  const openAddChild = (group?: string) => {
    setEditItem(null);
    setDefaultChildGroup(group);
    setShowForm(true);
  };

  const renderChildList = (list: Item[]) => (
    <div className="item-list">
      {list.map((item) => (
        <SwipeItem
          key={item.id}
          item={item}
          category={getCategory(item.categoryId)}
          onDone={() => markDone(item)}
          onSnooze={() => setSnoozeItem(item)}
          onEdit={() => setEditItem(item)}
          onDelete={() => deleteWithUndo(item, deleteItem, restoreItem)}
        />
      ))}
    </div>
  );

  const folderLabel = hasSubgroups ? "folder" : "project";

  return (
    <div className="view-page">
      <PageHeader
        title={parent.title}
        subtitle={
          category
            ? `${category.name}${progress?.goal ? ` · goal ${progress.goal}` : ""}`
            : progress?.goal
              ? `Goal: ${progress.goal}`
              : "Folder"
        }
        action={
          <button
            type="button"
            onClick={() =>
              navigate(backTo, { state: { areaId: state.areaId } })
            }
            className="btn-ghost rounded-xl px-3 py-2 text-sm"
          >
            {backLabel}
          </button>
        }
      />

      {progress && (
        <div className="item-card rounded-xl px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-[11px]">Progress</span>
            <span className="text-muted text-[11px] tabular-nums">
              {progress.label}
            </span>
          </div>
          <div className="bg-white/5 mt-2 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-sky-500/80 h-full rounded-full transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {hasSubgroups && grouped ? (
        <>
          {[...grouped.entries()].map(([key, list]) => {
            if (list.length === 0 && key === "__other__") return null;
            const isPreset = subgroups.includes(key);
            return (
              <section key={key} className="section-block">
                <SectionHeader
                  title={subgroupSectionLabel(key)}
                  count={list.length}
                  action={
                    isPreset ? (
                      <button
                        type="button"
                        onClick={() => openAddChild(key)}
                        className="text-sky-400 text-[11px] font-medium"
                      >
                        + Add
                      </button>
                    ) : null
                  }
                />
                {list.length === 0 ? (
                  <p className="text-muted text-xs">
                    No {subgroupSectionLabel(key).toLowerCase()} yet.
                  </p>
                ) : (
                  renderChildList(list)
                )}
              </section>
            );
          })}
        </>
      ) : children.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add subtasks inside this folder."
        />
      ) : (
        <section className="section-block">
          <SectionHeader title="Tasks" count={children.length} />
          {renderChildList(children)}
        </section>
      )}

      {doneChildren.length > 0 && (
        <section className="section-block">
          <SectionHeader
            title="Recently completed"
            count={doneChildren.length}
          />
          <div className="item-list opacity-70">
            {doneChildren.map((item) => (
              <SwipeItem
                key={item.id}
                item={item}
                category={getCategory(item.categoryId)}
                onDone={() => {}}
                onSnooze={() => {}}
                onEdit={() => setEditItem(item)}
                onDelete={() => deleteWithUndo(item, deleteItem, restoreItem)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="page-block pt-1">
        <button
          type="button"
          onClick={() => openAddChild(hasSubgroups ? subgroups[0] : undefined)}
          className="border-zinc-800 text-muted w-full rounded-xl border border-dashed py-3"
        >
          + Add task
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setEditItem(parent);
          }}
          className="btn-ghost w-full rounded-xl py-2.5 text-sm"
        >
          Edit {folderLabel}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (
              !window.confirm(`Delete "${parent.title}" and all its tasks?`)
            ) {
              return;
            }
            await deleteItemCascade(parent.id);
            navigate(backTo);
          }}
          className="text-red-400/90 w-full py-2 text-sm"
        >
          Delete {folderLabel}
        </button>
      </div>

      {(showForm || editItem) && (
        <ItemForm
          categories={categories}
          item={editItem}
          defaultType={
            editItem?.type ?? (showForm && !editItem ? "deadline" : undefined)
          }
          defaultParentId={!editItem && parent ? parent.id : undefined}
          defaultChildGroup={defaultChildGroup}
          lockCategoryId={parent.categoryId}
          childGroupOptions={subgroups}
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
            setDefaultChildGroup(undefined);
          }}
          onSave={async (data) => {
            if (editItem) {
              await updateItem(editItem.id, data);
            } else {
              await addItem({
                ...data,
                type:
                  data.type === "project"
                    ? "deadline"
                    : (data.type ?? "deadline"),
                categoryId: parent.categoryId,
                parentId: parent.id,
                sortOrder: nextChildSortOrder(items, parent.id),
                childGroup:
                  data.childGroup ??
                  defaultChildGroup ??
                  (hasSubgroups ? subgroups[0] : undefined),
              });
            }
            setShowForm(false);
            setEditItem(null);
            setDefaultChildGroup(undefined);
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
