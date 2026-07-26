import { Link } from "react-router-dom";

import type { WeeklyReview } from "../lib/weekly-review";

interface Props {
  review: WeeklyReview;
  onClose: () => void;
}

export function WeeklyReviewSheet({ review, onClose }: Props) {
  return (
    <div
      className="bg-overlay fixed inset-0 z-50 flex items-end "
      onClick={onClose}
    >
      <div
        className="modal-sheet max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-accent-bar mb-4 rounded-t-3xl" />
        <h2 className="text-primary text-lg font-semibold">Weekly review</h2>
        <p className="text-muted mt-1 text-sm">
          {review.wins} completion{review.wins === 1 ? "" : "s"} this week
        </p>

        <div className="mt-4 space-y-2">
          {review.sections.map((section) => (
            <div key={section.id} className="item-card rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-primary text-sm font-medium">
                    {section.title}
                  </p>
                  <p className="text-muted mt-0.5 text-xs">
                    {section.description}
                  </p>
                </div>
                <span className="text-primary text-lg font-semibold tabular-nums">
                  {section.count}
                </span>
              </div>
              {section.id === "nudge" && section.count > 0 && (
                <Link
                  to="/?focus=chase"
                  onClick={onClose}
                  className="text-violet-300 mt-2 inline-block text-xs font-medium"
                >
                  Work nudges →
                </Link>
              )}
              {section.id === "prep" && section.count > 0 && (
                <Link
                  to="/?focus=prep"
                  onClick={onClose}
                  className="text-violet-300 mt-2 inline-block text-xs font-medium"
                >
                  See prep deadlines →
                </Link>
              )}
              {section.id === "overdue" && section.count > 0 && (
                <Link
                  to="/?focus=overdue"
                  onClick={onClose}
                  className="text-violet-300 mt-2 inline-block text-xs font-medium"
                >
                  Tackle overdue →
                </Link>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-primary mt-4 w-full rounded-xl py-3 text-sm"
        >
          Close review
        </button>
      </div>
    </div>
  );
}
