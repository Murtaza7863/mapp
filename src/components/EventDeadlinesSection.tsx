import { Link } from "react-router-dom";

import type { Item } from "../types";

import {
  buildEventDeadlineEntries,
  deadlineUrgency,
  formatDeadlineDate,
} from "../lib/event-deadlines";
import { CalendarIcon } from "./icons";

interface Props {
  items: Item[];
  onSelect: (id: string) => void;
  compact?: boolean;
}

export function EventDeadlinesSection({ items, onSelect, compact }: Props) {
  const entries = buildEventDeadlineEntries(items);

  if (entries.length === 0) return null;

  const urgent = entries.filter(
    (e) => deadlineUrgency(e.daysUntilPrep) === "high",
  );

  return (
    <section className="section-block">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-block flex items-center gap-2 text-sm font-semibold">
          <CalendarIcon className="h-4 w-4" />
          Event prep deadlines
        </div>
        {(!compact || entries.length > 3) && (
          <Link to="/deadlines" className="text-muted text-[11px]">
            View all
          </Link>
        )}
      </div>
      {urgent.length > 0 && (
        <p className="text-warn mb-2 text-[11px]">
          {urgent.length} prep deadline{urgent.length === 1 ? "" : "s"} within a
          week
        </p>
      )}
      <div className="item-list">
        {(compact ? entries.slice(0, 3) : entries).map((entry) => {
          const urgency = deadlineUrgency(entry.daysUntilPrep);
          return (
            <button
              key={entry.item.id}
              type="button"
              onClick={() => onSelect(entry.item.id)}
              className="item-card w-full rounded-xl px-3.5 py-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-primary truncate text-[15px] font-medium">
                    {entry.item.contactName ?? entry.item.title}
                  </p>
                  <p className="text-muted mt-0.5 text-[11px]">
                    Event {formatDeadlineDate(entry.linkedEventAt)} · Prep due{" "}
                    {formatDeadlineDate(entry.prepDueAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-medium tabular-nums ${
                    urgency === "high"
                      ? "text-danger"
                      : urgency === "medium"
                        ? "text-warn"
                        : "text-muted"
                  }`}
                >
                  {entry.daysUntilPrep <= 0 ? "Due" : `${entry.daysUntilPrep}d`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
