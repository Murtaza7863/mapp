import { addDays, setHours, setMinutes, startOfDay } from "date-fns";

import type { Item } from "../types";

interface Props {
  items: Item[];
  onSchedule: (item: Item, dueAt: Date) => void;
  onDelete: (item: Item) => void;
  onClose: () => void;
}

export function TriageSession({ items, onSchedule, onDelete, onClose }: Props) {
  const current = items[0];

  if (!current) {
    return (
      <div
        className="bg-overlay fixed inset-0 z-50 flex items-end "
        onClick={onClose}
      >
        <div
          className="modal-sheet w-full rounded-t-3xl p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-primary text-lg font-semibold">Inbox zero</p>
          <p className="text-muted mt-1 text-sm">Everything has a plan.</p>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary mt-4 w-full rounded-xl py-3 text-sm"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const schedule = (days: number) => {
    const d = setMinutes(setHours(addDays(startOfDay(new Date()), days), 9), 0);
    onSchedule(current, d);
  };

  return (
    <div
      className="bg-overlay fixed inset-0 z-50 flex items-end "
      onClick={onClose}
    >
      <div
        className="modal-sheet w-full rounded-t-3xl p-5 pb-[calc(2rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-accent-bar mb-4 rounded-t-3xl" />
        <p className="text-muted text-xs">
          Triage {items.length} left · no date yet
        </p>
        <h2 className="text-primary mt-1 text-lg font-semibold">
          {current.title}
        </h2>
        {current.notes && (
          <p className="text-muted mt-1 line-clamp-2 text-sm">
            {current.notes}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => schedule(0)}
            className="daily-briefing-action justify-center py-3"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => schedule(1)}
            className="daily-briefing-action justify-center py-3"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => schedule(7)}
            className="daily-briefing-action justify-center py-3"
          >
            Next week
          </button>
          <button
            type="button"
            onClick={() => onDelete(current)}
            className="text-danger border-red-400/20 bg-red-400/8 justify-center rounded-lg border py-3 text-sm font-medium"
          >
            Delete
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted mt-3 w-full py-2 text-sm"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
