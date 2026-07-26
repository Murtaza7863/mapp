import { parseISO } from "date-fns";
import { useMemo, useState } from "react";

import { CategoryBadge } from "../components/CategoryBadge";
import { CheckIcon } from "../components/icons";
import { TypeBadge } from "../components/TypeBadge";
import { PageHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useCompletions, useItems } from "../hooks/useItems";
import { useToast } from "../hooks/useToast";
import { formatCompleted } from "../lib/dates";
import { ITEM_TYPE_LABELS } from "../types";

export function HistoryView() {
  const { completions } = useCompletions();
  const { items, reopen } = useItems();
  const { getCategory } = useCategories();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return completions.filter((entry) => {
      if (typeFilter !== "all" && entry.itemType !== typeFilter) return false;
      if (!q) return true;
      return (
        entry.itemTitle.toLowerCase().includes(q) ||
        entry.notes?.toLowerCase().includes(q) ||
        getCategory(entry.categoryId)?.name.toLowerCase().includes(q)
      );
    });
  }, [completions, query, typeFilter, getCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const key = parseISO(entry.completedAt).toDateString();
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const handleReopen = async (itemId: string, title: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      toast("Original item no longer exists", { kind: "error" });
      return;
    }
    await reopen(item);
    toast(`Reopened "${title}"`, { kind: "success" });
  };

  return (
    <div>
      <PageHeader title="History" subtitle="Completed items" />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search completed items…"
        className="border-zinc-800 bg-zinc-950 text-primary placeholder:text-muted mb-3 w-full rounded-xl border px-4 py-3 outline-none"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border-zinc-800 bg-zinc-900 text-primary rounded-lg border px-2 py-1.5 text-xs"
        >
          <option value="all">All types</option>
          {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-muted self-center text-xs">
          {filtered.length} completion{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="border-zinc-800 text-muted rounded-2xl border border-dashed p-8 text-center">
          {query ? "No matches" : "Nothing completed yet"}
        </div>
      ) : (
        grouped.map(([day, entries]) => (
          <section key={day} className="mb-6">
            <h2 className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
              {day}
            </h2>
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-zinc-900 bg-zinc-950/50 rounded-xl border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-primary font-medium">
                        {entry.itemTitle}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <CategoryBadge
                          category={getCategory(entry.categoryId)}
                        />
                        <TypeBadge type={entry.itemType} />
                      </div>
                      <p className="text-muted mt-2 text-xs">
                        {formatCompleted(entry.completedAt)}
                      </p>
                      {entry.notes && (
                        <p className="text-muted mt-1 text-xs">
                          {entry.notes}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          handleReopen(entry.itemId, entry.itemTitle)
                        }
                        className="text-sky-400 mt-3 min-h-[44px] text-xs font-medium"
                      >
                        Reopen
                      </button>
                    </div>
                    <CheckIcon className="text-emerald-500 h-4 w-4 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
