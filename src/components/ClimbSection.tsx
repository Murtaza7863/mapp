import { Link } from "react-router-dom";

import type { Category, Item } from "../types";

import {
  buildClimbEntries,
  formatGpdDue,
  gpdUrgency,
  getClimbCategoryId,
} from "../lib/climb";
import { MountainIcon } from "./icons";

interface Props {
  items: Item[];
  categories: Category[];
  onSelect: (id: string) => void;
  compact?: boolean;
}

export function ClimbSection({ items, categories, onSelect, compact }: Props) {
  const climbId = getClimbCategoryId(categories);
  const entries = buildClimbEntries(items, climbId);

  if (entries.length === 0) return null;

  const urgent = entries.filter((e) => gpdUrgency(e.daysUntilGpd) === "high");

  return (
    <section className="section-block">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-violet-300 flex items-center gap-2 text-sm font-semibold">
          <MountainIcon className="h-4 w-4" />
          CLIMB · GPD deadlines
        </div>
        {!compact && (
          <Link to="/climb" className="text-zinc-500 text-[11px]">
            View all
          </Link>
        )}
      </div>
      {urgent.length > 0 && (
        <p className="text-amber-400/90 mb-2 text-[11px]">
          {urgent.length} GPD deadline{urgent.length === 1 ? "" : "s"} within a
          week
        </p>
      )}
      <div className="item-list">
        {(compact ? entries.slice(0, 3) : entries).map((entry) => {
          const urgency = gpdUrgency(entry.daysUntilGpd);
          return (
            <button
              key={entry.item.id}
              type="button"
              onClick={() => onSelect(entry.item.id)}
              className="item-card w-full rounded-xl px-3.5 py-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-zinc-100 truncate text-[15px] font-medium">
                    {entry.item.contactName ?? entry.item.title}
                  </p>
                  <p className="text-zinc-500 mt-0.5 text-[11px]">
                    Event {formatGpdDue(entry.linkedEventAt)} · GPD due{" "}
                    {formatGpdDue(entry.gpdDueAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-medium tabular-nums ${
                    urgency === "high"
                      ? "text-red-400"
                      : urgency === "medium"
                        ? "text-amber-400"
                        : "text-zinc-500"
                  }`}
                >
                  {entry.daysUntilGpd <= 0 ? "Due" : `${entry.daysUntilGpd}d`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
