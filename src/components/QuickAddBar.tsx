import { useState } from "react";

import { looksLikeMultiCapture, readClipboardText } from "../lib/clipboard";
import { parseQuickAdd } from "../lib/quickadd";
import type { Category, ItemInput } from "../types";

interface Props {
  categories: Category[];
  onAdd: (input: Partial<ItemInput> & { title: string }) => Promise<void>;
  onPasteToPlot?: (text: string) => void;
}

export function QuickAddBar({ categories, onAdd, onPasteToPlot }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const paste = async () => {
    const text = await readClipboardText();
    if (!text) return;
    if (looksLikeMultiCapture(text) && onPasteToPlot) {
      onPasteToPlot(text);
      return;
    }
    setValue(text);
  };

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    const parsed = parseQuickAdd(trimmed, categories);
    if (!parsed.title.trim()) return;

    const isFollowUp =
      parsed.type === "follow-up" ||
      /\bfollow|email|call|bump\b/i.test(trimmed);

    setSaving(true);
    try {
      await onAdd({
        title: parsed.title,
        type: isFollowUp ? "follow-up" : (parsed.type ?? "deadline"),
        categoryId: parsed.categoryId ?? categories[0]?.id,
        dueAt: parsed.dueAt,
        priority: parsed.priority,
        ...(parsed.contactName ? { contactName: parsed.contactName } : {}),
        ...(parsed.nextAction ? { nextAction: parsed.nextAction } : {}),
        ...(isFollowUp
          ? {
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
        placeholder="Quick add — bump @jake → send deck"
        className="input-field min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
        aria-label="Quick add task"
      />
      <button
        type="button"
        onClick={() => void paste()}
        className="border-zinc-800 text-zinc-500 shrink-0 rounded-xl border px-3 py-2.5 text-xs"
        aria-label="Paste from clipboard"
      >
        Paste
      </button>
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
