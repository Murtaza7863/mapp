import { addDays, setHours, setMinutes, startOfDay } from "date-fns";

import type { WrapUpSummary } from "../lib/wrapup";

interface Props {
  summary: WrapUpSummary;
  onClose: () => void;
  onParkForTomorrow: () => void;
  onOpenNudges: () => void;
}

export function WrapUpSheet({
  summary,
  onClose,
  onParkForTomorrow,
  onOpenNudges,
}: Props) {
  return (
    <div
      className="bg-overlay fixed inset-0 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="modal-sheet w-full rounded-t-3xl p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-accent-bar mb-4 rounded-t-3xl" />
        <h2 className="text-primary text-lg font-semibold">End of day</h2>
        <p className="text-muted mt-1 text-sm">{summary.headline}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Done" value={summary.doneToday} />
          <Stat label="Open" value={summary.stillOpen} />
          <Stat label="Overdue" value={summary.overdue} />
        </div>

        <div className="mt-4 space-y-2">
          {summary.parkable.length > 0 && (
            <button
              type="button"
              onClick={onParkForTomorrow}
              className="btn-primary w-full rounded-xl py-3 text-sm"
            >
              Park {summary.parkable.length} for tomorrow 9am
            </button>
          )}
          {summary.needsNudge > 0 && (
            <button
              type="button"
              onClick={onOpenNudges}
              className="daily-briefing-action w-full justify-center py-3"
            >
              Work {summary.needsNudge} nudge
              {summary.needsNudge === 1 ? "" : "s"} before bed
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-muted w-full py-2 text-sm"
          >
            Done for today
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="item-card rounded-xl px-3 py-2 text-center">
      <p className="text-muted text-[10px] uppercase">{label}</p>
      <p className="text-primary text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function tomorrowMorning(now = new Date()): Date {
  const d = addDays(startOfDay(now), 1);
  return setMinutes(setHours(d, 9), 0);
}
