import { Link } from "react-router-dom";

import type { FeedFocus } from "../lib/feed";
import type { TodaySummary } from "../lib/stats";

import { CategoryIcon } from "./CategoryIcon";
import { ChevronRightIcon } from "./icons";

const CHIP_STYLES: Record<string, string> = {
  Overdue: "text-red-400 border-red-400/20 bg-red-400/8",
  Today: "text-sky-300 border-sky-400/20 bg-sky-400/8",
  Routines: "text-emerald-300 border-emerald-400/20 bg-emerald-400/8",
  Waiting: "text-violet-300 border-violet-400/20 bg-violet-400/8",
  Snoozed: "text-amber-300 border-amber-400/20 bg-amber-400/8",
  Priority: "text-yellow-300 border-yellow-400/20 bg-yellow-400/8",
};

const CHIP_FOCUS: Record<string, FeedFocus> = {
  Overdue: "overdue",
  Today: "today",
  Routines: "routine",
  Waiting: "follow-up",
  Snoozed: "snoozed",
  Priority: "priority",
};

interface Props {
  summary: TodaySummary;
  focus?: FeedFocus | null;
  onFocusChange?: (focus: FeedFocus | null) => void;
}

export function TodayStats({ summary, focus = null, onFocusChange }: Props) {
  const chips = [
    { label: "Overdue", value: summary.overdue },
    { label: "Today", value: summary.dueToday },
    { label: "Routines", value: summary.routines },
    { label: "Waiting", value: summary.followUps },
    { label: "Snoozed", value: summary.snoozed },
    { label: "Priority", value: summary.priority },
  ].filter((c) => c.value > 0);

  if (chips.length === 0) return null;

  return (
    <div className="glass-card mb-6 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-label">Summary</h2>
        <Link
          to="/insights"
          className="text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 text-xs font-medium transition-colors"
        >
          Insights
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const chipFocus = CHIP_FOCUS[chip.label];
          const active = focus === chipFocus;
          const interactive = Boolean(onFocusChange && chipFocus);
          const className = `stat-chip rounded-full border px-3 py-1 text-xs font-semibold ${CHIP_STYLES[chip.label]} ${
            active ? "ring-1 ring-white/30" : ""
          } ${interactive ? "cursor-pointer" : ""}`;

          if (!interactive) {
            return (
              <span key={chip.label} className={className}>
                <span className="mr-1 opacity-70">{chip.value}</span>
                {chip.label}
              </span>
            );
          }

          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onFocusChange?.(active ? null : (chipFocus ?? null))
              }
              className={className}
            >
              <span className="mr-1 opacity-70">{chip.value}</span>
              {chip.label}
            </button>
          );
        })}
      </div>
      {summary.byCategory.length > 0 && (
        <div className="border-white/5 mt-3 flex flex-wrap gap-1.5 border-t pt-3">
          {summary.byCategory.map(({ category, count }) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${category.color}14`,
                borderColor: `${category.color}28`,
                color: category.color,
              }}
            >
              <CategoryIcon category={category} className="h-2.5 w-2.5" />
              {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
