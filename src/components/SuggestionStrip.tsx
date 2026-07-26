import { Link } from "react-router-dom";

import type { Suggestion } from "../lib/pipeline";

export function SuggestionStrip({
  suggestions,
  onSelect,
}: {
  suggestions: Suggestion[];
  onSelect: (itemId: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="page-block">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-zinc-500 text-xs font-medium tracking-wide uppercase">
          Needs a nudge
        </h2>
        <Link to="/follow-ups" className="text-zinc-600 text-[11px]">
          All threads
        </Link>
      </div>
      <div className="item-list">
        {suggestions.slice(0, 4).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.itemId)}
            className="item-card w-full rounded-xl px-3.5 py-3 text-left"
          >
            <p className="text-zinc-200 truncate text-sm font-medium">
              {s.title}
            </p>
            <p
              className={`mt-0.5 text-[11px] ${
                s.urgency === "high" ? "text-amber-400/90" : "text-zinc-500"
              }`}
            >
              {s.reason}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
