import { useMemo, useState } from "react";

import type { Item } from "../types";

import { CategoryBadge } from "../components/CategoryBadge";
import { CloseIcon } from "../components/icons";
import { ItemForm } from "../components/ItemForm";
import { PageHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { useUndo } from "../hooks/useUndo";
import { formatDue } from "../lib/dates";

export function NotesView() {
  const { items, addItem, updateItem, deleteItem, restoreItem } = useItems();
  const { categories, getCategory } = useCategories();
  const { deleteWithUndo } = useUndo();
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => i.type === "note")
      .filter(
        (i) =>
          !q ||
          i.title.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [items, query]);

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Saved for later"
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary rounded-xl px-4 py-2 text-sm"
          >
            + Add
          </button>
        }
      />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter notes…"
        className="border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 mb-4 w-full rounded-xl border px-4 py-3 outline-none"
      />

      {notes.length === 0 ? (
        <div className="border-zinc-800 text-zinc-500 rounded-2xl border border-dashed p-8 text-center">
          No notes yet
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="border-zinc-900 bg-zinc-950/60 cursor-pointer rounded-xl border p-4"
              onClick={() => setEditItem(note)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{note.title}</h3>
                  {note.notes && (
                    <p className="text-zinc-400 mt-1 line-clamp-3 text-sm">
                      {note.notes}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <CategoryBadge category={getCategory(note.categoryId)} />
                    {note.dueAt && (
                      <span className="text-zinc-500 text-xs">
                        {formatDue(note.dueAt)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWithUndo(note, deleteItem, restoreItem);
                  }}
                  className="text-zinc-600 hover:text-red-400 shrink-0 p-1"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showForm || editItem) && (
        <ItemForm
          categories={categories}
          item={editItem}
          defaultType="note"
          onClose={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          onSave={async (data) => {
            const payload = { ...data, type: "note" as const };
            if (editItem) await updateItem(editItem.id, payload);
            else await addItem(payload);
            setShowForm(false);
            setEditItem(null);
          }}
        />
      )}
    </div>
  );
}
