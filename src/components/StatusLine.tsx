import { Link } from "react-router-dom";

import type { FeedFocus } from "../lib/feed";
import type { MomentumSummary } from "../lib/momentum";
import type { TodaySummary } from "../lib/stats";

interface Props {
  summary: TodaySummary;
  momentum: MomentumSummary;
  focus?: FeedFocus | null;
  onFocusChange?: (focus: FeedFocus | null) => void;
  onTriage?: () => void;
  onWrapUp?: () => void;
  showWrapUp?: boolean;
}

function Sep() {
  return (
    <span className="status-line-sep" aria-hidden>
      ·
    </span>
  );
}

export function StatusLine({
  summary,
  momentum,
  focus = null,
  onFocusChange,
  onTriage,
  onWrapUp,
  showWrapUp,
}: Props) {
  const items: React.ReactNode[] = [];

  if (summary.dueToday > 0 && onFocusChange) {
    items.push(
      <button
        key="today"
        type="button"
        aria-pressed={focus === "today"}
        onClick={() => onFocusChange(focus === "today" ? null : "today")}
      >
        {summary.dueToday} today
      </button>,
    );
  }

  if (summary.overdue > 0 && onFocusChange) {
    items.push(
      <button
        key="overdue"
        type="button"
        aria-pressed={focus === "overdue"}
        onClick={() => onFocusChange(focus === "overdue" ? null : "overdue")}
      >
        {summary.overdue} overdue
      </button>,
    );
  }

  if (summary.needsNudge > 0 && onFocusChange) {
    items.push(
      <button
        key="nudge"
        type="button"
        aria-pressed={focus === "chase"}
        onClick={() => onFocusChange(focus === "chase" ? null : "chase")}
      >
        {summary.needsNudge} to nudge
      </button>,
    );
  }

  if (summary.triage > 0 && onTriage) {
    items.push(
      <button key="triage" type="button" onClick={onTriage}>
        {summary.triage === 1
          ? "1 needs a date"
          : `${summary.triage} need a date`}
      </button>,
    );
  }

  if (summary.urgentPrep > 0 && onFocusChange) {
    items.push(
      <button
        key="prep"
        type="button"
        aria-pressed={focus === "prep"}
        onClick={() => onFocusChange(focus === "prep" ? null : "prep")}
      >
        {summary.urgentPrep} to prep
      </button>,
    );
  }

  const streak =
    momentum.streakDays > 1 ? `${momentum.streakDays}-day streak` : null;

  // With nothing to count this strip would just echo the briefing headline.
  const hasContent =
    items.length > 0 ||
    summary.openThreads > 0 ||
    streak !== null ||
    Boolean(showWrapUp && onWrapUp);
  if (!hasContent) return null;

  return (
    <div className="status-line">
      {items.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <Sep />}
          {node}
        </span>
      ))}
      {summary.openThreads > 0 && (
        <>
          {items.length > 0 && <Sep />}
          <Link to="/follow-ups">
            {summary.openThreads} follow-up
            {summary.openThreads === 1 ? "" : "s"}
          </Link>
        </>
      )}
      {streak && (
        <>
          <Sep />
          <span>{streak}</span>
        </>
      )}
      {showWrapUp && onWrapUp && (
        <>
          <Sep />
          <button type="button" onClick={onWrapUp}>
            Wrap up day
          </button>
        </>
      )}
    </div>
  );
}
