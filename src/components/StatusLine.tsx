import { Link } from "react-router-dom";

import type { DailyBriefing } from "../lib/briefing";
import type { FeedFocus } from "../lib/feed";
import type { MomentumSummary } from "../lib/momentum";
import type { TodaySummary } from "../lib/stats";

interface Props {
  briefing: DailyBriefing;
  summary: TodaySummary;
  momentum: MomentumSummary;
  focus?: FeedFocus | null;
  onFocusChange?: (focus: FeedFocus | null) => void;
  onTriage?: () => void;
  onWrapUp?: () => void;
  showWrapUp?: boolean;
}

function Sep() {
  return <span className="status-line-sep" aria-hidden>·</span>;
}

export function StatusLine({
  briefing,
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
        {summary.triage} need a date
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

  return (
    <div className="status-line">
      {items.length === 0 ? (
        <span>{briefing.headline}</span>
      ) : (
        items.map((node, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <Sep />}
            {node}
          </span>
        ))
      )}
      {summary.openThreads > 0 && (
        <>
          {items.length > 0 && <Sep />}
          <Link to="/follow-ups">
            {summary.openThreads} open thread{summary.openThreads === 1 ? "" : "s"}
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
