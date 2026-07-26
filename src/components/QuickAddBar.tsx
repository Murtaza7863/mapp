import { useState } from "react";

import { parseQuickAdd } from "../lib/quickadd";
import type { Category, ItemInput } from "../types";

interface Props {
  categories: Category[];
  onAdd: (input: Partial<ItemInput> & { title: string }) => Promise<void>;
}

export function QuickAddBar({ categories, onAdd }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    const parsed = parseQuickAdd(trimmed, categories);
    if (!parsed.title.trim()) return;

    setSaving(true);
    try {
      await onAdd({
        title: parsed.title,
        type: parsed.type ?? "deadline",
        categoryId: parsed.categoryId ?? categories[0]?.id,
        dueAt: parsed.dueAt,
        priority: parsed.priority,
        ...(parsed.type === "follow-up" || /\bfollow|email|call|bump\b/i.test(trimmed)
          ? {
              type: "follow-up" as const,
              pipelineStage: "outreach" as const,
              lastContactAt: new Date().toISOString(),
            }
          : {}),
      });
      setValue("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        placeholder="Quick add — pay rent tomorrow !"
        className="input-field min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
        aria-label="Quick add task"
      />
      <button
        type="button"
        disabled={!value.trim() || saving}
        onClick={() => void submit()}
        className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}
