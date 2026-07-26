import type { Item } from "../types";

import type { Suggestion } from "../lib/pipeline";
import { ThreadActions } from "./ThreadActions";

interface Props {
  suggestions: Suggestion[];
  items: Item[];
  onSelect: (itemId: string) => void;
  onUpdate: (itemId: string, changes: Partial<Item>) => void;
  max?: number;
  compact?: boolean;
}

export function NudgeQueue({
  suggestions,
  items,
  onSelect,
  onUpdate,
  max = 5,
  compact,
}: Props) {
  const visible = suggestions.slice(0, max);
  if (visible.length === 0) return null;

  return (
    <section className="nudge-queue" aria-label="Nudge queue">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-primary text-sm font-semibold">
          Work these first
        </h2>
        {suggestions.length > max && (
          <span className="text-muted text-[11px]">
            +{suggestions.length - max} more in feed
          </span>
        )}
      </div>
      <div className="space-y-2">
        {visible.map((suggestion) => {
          const item = items.find((i) => i.id === suggestion.itemId);
          if (!item) return null;

          return (
            <div key={suggestion.id} className="nudge-queue-card rounded-xl">
              <button
                type="button"
                onClick={() => onSelect(suggestion.itemId)}
                className="item-card w-full rounded-xl px-3.5 py-3 text-left"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      suggestion.urgency === "high"
                        ? "bg-red-400"
                        : "bg-amber-400"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-primary truncate text-[15px] font-medium">
                      {suggestion.title}
                    </p>
                    <p className="text-warn mt-0.5 text-[11px]">
                      {suggestion.reason}
                    </p>
                  </div>
                </div>
              </button>
              {!compact && (
                <ThreadActions
                  item={item}
                  onUpdate={(changes) => onUpdate(item.id, changes)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
