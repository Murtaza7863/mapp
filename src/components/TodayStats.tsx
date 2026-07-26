import { Link } from "react-router-dom";

import type { FeedFocus } from "../lib/feed";
import type { TodaySummary } from "../lib/stats";

import { CategoryIcon } from "./CategoryIcon";
import { ChevronRightIcon } from "./icons";

const CHIP_STYLES: Record<string, string> = {
  Overdue: "text-red-400 border-red-400/20 bg-red-400/8",
  Today: "text-sky-300 border-sky-400/20 bg-sky-400/8",
  Routines: "text-emerald-300 border-emerald-400/20 bg-emerald-400/8",
  Nudge: "text-violet-300 border-violet-400/20 bg-violet-400/8",
  Prep: "text-fuchsia-300 border-fuchsia-400/20 bg-fuchsia-400/8",
  Triage: "text-orange-300 border-orange-400/20 bg-orange-400/8",
  Open: "text-violet-300/70 border-violet-400/15 bg-violet-400/5",
  Snoozed: "text-amber-300 border-amber-400/20 bg-amber-400/8",
  Priority: "text-yellow-300 border-yellow-400/20 bg-yellow-400/8",
};

const CHIP_FOCUS: Record<string, FeedFocus> = {
  Overdue: "overdue",
  Today: "today",
  Routines: "routine",
  Nudge: "chase",
  Prep: "prep",
  Snoozed: "snoozed",
  Priority: "priority",
};

interface Props {
  summary: TodaySummary;
  focus?: FeedFocus | null;
  areaFilter?: string | null;
  onFocusChange?: (focus: FeedFocus | null) => void;
  onAreaFilterChange?: (categoryId: string | null) => void;
  onTriage?: () => void;
}

export function TodayStats({
  summary,
  focus = null,
  areaFilter = null,
  onFocusChange,
  onAreaFilterChange,
  onTriage,
}: Props) {
  const chips = [
    { label: "Overdue", value: summary.overdue },
    { label: "Today", value: summary.dueToday },
    { label: "Routines", value: summary.routines },
    { label: "Nudge", value: summary.needsNudge },
    { label: "Prep", value: summary.urgentPrep },
    { label: "Triage", value: summary.triage, action: onTriage },
    { label: "Open", value: summary.openThreads, link: "/follow-ups" },
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
          className="text-muted hover:text-primary flex items-center gap-0.5 text-xs font-medium transition-colors"
        >
          Insights
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const chipFocus = CHIP_FOCUS[chip.label];
          const active = focus === chipFocus;
          const className = `stat-chip rounded-full border px-3 py-1 text-xs font-semibold ${CHIP_STYLES[chip.label]} ${
            active ? "ring-1 ring-white/30" : ""
          }`;

          if ("link" in chip && chip.link) {
            return (
              <Link key={chip.label} to={chip.link} className={className}>
                <span className="mr-1 opacity-70">{chip.value}</span>
                {chip.label}
              </Link>
            );
          }

          if ("action" in chip && chip.action) {
            return (
              <button
                key={chip.label}
                type="button"
                onClick={chip.action}
                className={`${className} cursor-pointer`}
              >
                <span className="mr-1 opacity-70">{chip.value}</span>
                {chip.label}
              </button>
            );
          }

          if (!onFocusChange || !chipFocus) {
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
                onFocusChange(active ? null : (chipFocus ?? null))
              }
              className={`${className} cursor-pointer`}
            >
              <span className="mr-1 opacity-70">{chip.value}</span>
              {chip.label}
            </button>
          );
        })}
      </div>
      {summary.byCategory.length > 0 && (
        <div className="border-white/5 mt-3 flex flex-wrap gap-1.5 border-t pt-3">
          {summary.byCategory.map(({ category, count }) => {
            const active = areaFilter === category.id;
            const style = {
              backgroundColor: `${category.color}14`,
              borderColor: `${category.color}28`,
              color: category.color,
            };
            const className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              active ? "ring-1 ring-white/25" : ""
            }`;

            if (!onAreaFilterChange) {
              return (
                <span key={category.id} className={className} style={style}>
                  <CategoryIcon category={category} className="h-2.5 w-2.5" />
                  {count}
                </span>
              );
            }

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onAreaFilterChange(active ? null : category.id)
                }
                className={`${className} cursor-pointer`}
                style={style}
              >
                <CategoryIcon category={category} className="h-2.5 w-2.5" />
                {count}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
