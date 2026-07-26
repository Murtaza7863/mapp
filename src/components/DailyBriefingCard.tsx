import { Link } from "react-router-dom";

import type { DailyBriefing } from "../lib/briefing";

interface Props {
  briefing: DailyBriefing;
  onFocusNudge?: () => void;
  onFocusOverdue?: () => void;
  onFocusPrep?: () => void;
  onWrapUp?: () => void;
  showWrapUp?: boolean;
}

export function DailyBriefingCard({
  briefing,
  onFocusNudge,
  onFocusOverdue,
  onFocusPrep,
  onWrapUp,
  showWrapUp,
}: Props) {
  const { headline, subline, needsNudge, overdue, urgentPrep } = briefing;
  const isClear = needsNudge === 0 && overdue === 0 && urgentPrep === 0;

  return (
    <section className="daily-briefing mb-4 rounded-2xl p-4">
      <p className="text-zinc-100 text-[15px] font-semibold leading-snug">
        {headline}
      </p>
      <p className="text-zinc-500 mt-1 text-xs">{subline}</p>
      {(!isClear || showWrapUp) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {needsNudge > 0 && onFocusNudge && (
            <button
              type="button"
              onClick={onFocusNudge}
              className="daily-briefing-action"
            >
              Work nudges
            </button>
          )}
          {urgentPrep > 0 && onFocusPrep && (
            <button
              type="button"
              onClick={onFocusPrep}
              className="daily-briefing-action"
            >
              Event prep
            </button>
          )}
          {overdue > 0 && onFocusOverdue && (
            <button
              type="button"
              onClick={onFocusOverdue}
              className="daily-briefing-action"
            >
              See overdue
            </button>
          )}
          {needsNudge > 0 && (
            <Link to="/follow-ups?nudge=1" className="daily-briefing-action">
              All threads
            </Link>
          )}
          {showWrapUp && onWrapUp && (
            <button
              type="button"
              onClick={onWrapUp}
              className="daily-briefing-action"
            >
              Wrap up day
            </button>
          )}
        </div>
      )}
    </section>
  );
}
