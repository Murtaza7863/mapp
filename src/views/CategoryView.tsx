import { parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import type { Category, Item } from "../types";

import { ContainerCard, containerProgress } from "../components/ContainerCard";
import { DotsIcon, FolderIcon, GridIcon, PlusIcon } from "../components/icons";
import { ItemForm, SnoozeSheet } from "../components/ItemForm";
import { SubgroupQuickAddHelp } from "../components/SubgroupQuickAddHelp";
import { SwipeItem } from "../components/SwipeItem";
import { PageHeader, SectionHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useToast } from "../hooks/useToast";
import { useUndo } from "../hooks/useUndo";
import { getContainersForCategory } from "../lib/containers";
import { filterTopLevelForArea } from "../lib/projects";

interface LocationState {
  areaId?: string;
}

export function CategoryView() {
  const location = useLocation();
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
  const {
    categories,
    getCategory,
    addCategory,
    updateCategory,
    deleteCategory,
    moveCategory,
  } = useCategories();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<Item | null>(null);
  const [managing, setManaging] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    const areaId = (location.state as LocationState | null)?.areaId;
    if (areaId && categories.some((c) => c.id === areaId)) {
      setSelectedId(areaId);
    }
  }, [location.state, categories]);

  const looseItems = useMemo(() => {
    const pending = filterTopLevelForArea(
      items.filter((i) => i.status !== "done"),
    );
    if (selectedId === "all") return pending;
    return pending.filter((i) => i.categoryId === selectedId);
  }, [items, selectedId]);

  const containersForArea = useMemo(() => {
    if (selectedId === "all") return [];
    return getContainersForCategory(items, selectedId);
  }, [items, selectedId]);

  const grouped = useMemo(() => {
    if (selectedId !== "all") return null;
    const map = new Map<string, { folders: Item[]; tasks: Item[] }>();
    for (const cat of categories) {
      map.set(cat.id, {
        folders: getContainersForCategory(items, cat.id),
        tasks: [],
      });
    }
    const uncategorized: Item[] = [];
    for (const item of looseItems) {
      const bucket = map.get(item.categoryId);
      if (bucket) bucket.tasks.push(item);
      else uncategorized.push(item);
    }
    return { map, uncategorized };
  }, [looseItems, categories, items, selectedId]);

  const selectedCategory =
    selectedId === "all" ? undefined : getCategory(selectedId);

  const folderNavState = (cat: Category) => ({
    backTo: "/categories",
    backLabel: cat.name,
    areaId: cat.id,
  });

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const colors = ["#f97316", "#ec4899", "#14b8a6", "#eab308", "#6366f1"];
    await addCategory({
      name: newCatName.trim(),
      color: colors[categories.length % colors.length],
      icon: "folder",
    });
    setNewCatName("");
  };

  const parseSubgroups = (value: string): string[] =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const renderTaskList = (list: Item[], cat?: Category) => (
    <div className="item-list">
      {list.sort(sortByDue).map((item) => (
        <SwipeItem
          key={item.id}
          item={item}
          category={cat ?? getCategory(item.categoryId)}
          onDone={() => markDone(item)}
          onSnooze={() => setSnoozeItem(item)}
          onEdit={() => setEditItem(item)}
          onDelete={() => deleteWithUndo(item, deleteItem, restoreItem)}
        />
      ))}
    </div>
  );

  const renderFolders = (folders: Item[], cat: Category) => {
    if (folders.length === 0) return null;
    return (
      <div className="item-list">
        {folders.map((folder) => (
          <Link
            key={folder.id}
            to={`/folders/${folder.id}`}
            state={folderNavState(cat)}
          >
            <ContainerCard
              item={folder}
              progress={containerProgress(folder, items)}
              to={`/folders/${folder.id}`}
              allItems={items}
            />
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="view-page">
      <PageHeader
        title="Areas"
        subtitle="Folders, subgroups, and tasks per area"
        action={
          <div className="flex items-center gap-1">
            {selectedId !== "all" && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="btn-ghost rounded-xl p-2"
                aria-label="Add task"
                title="Add task"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setManaging(!managing)}
              className="btn-ghost rounded-xl p-2"
              aria-label="Area options"
              title="Edit areas"
            >
              <DotsIcon className="h-5 w-5" />
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <CategoryChip
          category={{
            id: "all",
            name: "All",
            color: "#64748b",
          }}
          active={selectedId === "all"}
          onClick={() => setSelectedId("all")}
        />
        {categories.map((cat) => (
          <CategoryChip
            key={cat.id}
            category={cat}
            active={selectedId === cat.id}
            onClick={() => setSelectedId(cat.id)}
          />
        ))}
      </div>

      {managing && (
        <div className="item-card rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-primary text-sm font-medium">Edit areas</h3>
            <button
              type="button"
              onClick={() => setManaging(false)}
              className="text-muted text-xs"
            >
              Done
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Side project"
              className="input-field flex-1 rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="btn-primary shrink-0 rounded-xl px-4 text-sm"
            >
              Add
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="border-white/[0.04] space-y-2 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={cat.name}
                    onChange={(e) =>
                      updateCategory(cat.id, { name: e.target.value })
                    }
                    className="input-field flex-1 rounded-xl px-3 py-2 text-sm"
                  />
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) =>
                      updateCategory(cat.id, { color: e.target.value })
                    }
                    className="h-8 w-10 rounded border-0 bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteCategory(cat.id);
                        if (selectedId === cat.id) setSelectedId("all");
                      } catch (err) {
                        toast(
                          err instanceof Error
                            ? err.message
                            : "Could not delete area",
                          { kind: "error" },
                        );
                      }
                    }}
                    className="text-red-400 text-sm"
                  >
                    Delete
                  </button>
                </div>
                <input
                  value={(cat.subgroups ?? []).join(", ")}
                  onChange={(e) =>
                    updateCategory(cat.id, {
                      subgroups: parseSubgroups(e.target.value),
                    })
                  }
                  placeholder="Subgroups: Tasks, Projects (comma separated)"
                  className="input-field w-full rounded-xl px-3 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveCategory(cat.id, "up")}
                    className="btn-ghost flex-1 rounded-lg py-2 text-xs"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCategory(cat.id, "down")}
                    className="btn-ghost flex-1 rounded-lg py-2 text-xs"
                  >
                    Move down
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedId !== "all" && selectedCategory && (
        <>
          {selectedCategory.subgroups &&
            selectedCategory.subgroups.length > 0 && (
              <SubgroupQuickAddHelp
                categoryName={selectedCategory.name}
                subgroups={selectedCategory.subgroups}
              />
            )}
          <section className="section-block">
            <SectionHeader
              title="Folders"
              count={containersForArea.length}
              action={
                <button
                  type="button"
                  onClick={() => setShowFolderForm(true)}
                  className="text-sky-400 text-[11px] font-medium"
                >
                  + New
                </button>
              }
            />
            {containersForArea.length === 0 ? (
              <p className="text-muted text-xs">
                No folders yet. Create one to group tasks
                {selectedCategory.subgroups?.length
                  ? ` by ${selectedCategory.subgroups.join(", ").toLowerCase()}`
                  : ""}
                .
              </p>
            ) : (
              renderFolders(containersForArea, selectedCategory)
            )}
          </section>

          <section className="section-block">
            <SectionHeader title="Tasks" count={looseItems.length} />
            {looseItems.length === 0 ? (
              <p className="text-muted text-xs">No standalone tasks.</p>
            ) : (
              renderTaskList(looseItems, selectedCategory)
            )}
          </section>
        </>
      )}

      {selectedId === "all" && grouped && (
        <>
          {categories.map((cat) => {
            const { folders, tasks } = grouped.map.get(cat.id) ?? {
              folders: [],
              tasks: [],
            };
            if (folders.length === 0 && tasks.length === 0) return null;
            return (
              <section key={cat.id} className="section-block">
                <button
                  type="button"
                  onClick={() => setSelectedId(cat.id)}
                  className="flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
                  style={{ color: cat.color }}
                >
                  <AreaDot color={cat.color} />
                  {cat.name}
                  <span className="text-muted text-[11px] font-normal">
                    tap to open
                  </span>
                </button>
                {folders.length > 0 && (
                  <div className="mt-2">{renderFolders(folders, cat)}</div>
                )}
                {tasks.length > 0 && (
                  <div className={folders.length > 0 ? "mt-2" : "mt-2"}>
                    {renderTaskList(tasks, cat)}
                  </div>
                )}
              </section>
            );
          })}
          {grouped.uncategorized.length > 0 && (
            <section className="section-block">
              <div className="text-muted flex items-center gap-2 text-sm font-semibold">
                <FolderIcon className="h-4 w-4" />
                Uncategorized
              </div>
              <div className="mt-2">
                {renderTaskList(grouped.uncategorized)}
              </div>
            </section>
          )}
        </>
      )}

      {selectedId === "all" ? (
        <p className="text-muted border-zinc-800 rounded-xl border border-dashed px-4 py-3.5 text-center text-sm">
          Select an area above to add tasks or folders
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowFolderForm(true)}
            className="border-zinc-800 text-muted flex-1 rounded-xl border border-dashed py-3.5"
          >
            + New folder
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="border-zinc-800 text-muted flex-1 rounded-xl border border-dashed py-3.5"
          >
            + Add task
          </button>
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
            if (editItem) await updateItem(editItem.id, data);
            else
              await addItem({
                ...data,
                categoryId: selectedId === "all" ? data.categoryId : selectedId,
              });
            setShowForm(false);
            setEditItem(null);
          }}
        />
      )}

      {showFolderForm && selectedId !== "all" && (
        <ItemForm
          categories={categories}
          defaultType="project"
          lockCategoryId={selectedId}
          onClose={() => setShowFolderForm(false)}
          onSave={async (data) => {
            await addItem({
              ...data,
              type: "project",
              categoryId: selectedId,
            });
            setShowFolderForm(false);
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

function CategoryChip({
  category,
  active,
  onClick,
}: {
  category: Pick<Category, "id" | "name" | "color">;
  active: boolean;
  onClick: () => void;
}) {
  const isAll = category.id === "all";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? "ring-offset-slate-950 ring-2 ring-offset-2" : "opacity-70"
      }`}
      style={{
        backgroundColor: `${category.color}22`,
        color: category.color,
        ...(active ? { boxShadow: `0 0 0 2px ${category.color}` } : {}),
      }}
    >
      {isAll ? (
        <GridIcon className="h-3.5 w-3.5" style={{ color: category.color }} />
      ) : (
        <AreaDot color={category.color} />
      )}
      {category.name}
    </button>
  );
}

function AreaDot({ color }: { color: string }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function sortByDue(a: Item, b: Item) {
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return parseISO(a.dueAt).getTime() - parseISO(b.dueAt).getTime();
}
