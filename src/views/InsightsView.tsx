import { format } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CategoryBadge } from "../components/CategoryBadge";
import { TypeBadge } from "../components/TypeBadge";
import { WeeklyReviewSheet } from "../components/WeeklyReviewSheet";
import { PageHeader } from "../components/ui";
import { db } from "../db";
import { useCategories } from "../hooks/useCategories";
import { useCompletions, useItems } from "../hooks/useItems";
import { computeWeeklyInsights } from "../lib/stats";
import {
  buildWeeklyReview,
  shouldSuggestWeeklyReview,
} from "../lib/weekly-review";
import { ITEM_TYPE_LABELS } from "../types";

export function InsightsView() {
  const { items } = useItems();
  const { completions } = useCompletions();
  const { categories } = useCategories();
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [reviewOpen, setReviewOpen] = useState(false);

  const insights = useMemo(
    () =>
      computeWeeklyInsights(
        completions,
        categories,
        settings?.weekStartsOnMonday ?? false,
      ),
    [completions, categories, settings?.weekStartsOnMonday],
  );

  const weeklyReview = useMemo(
    () =>
      buildWeeklyReview(
        items,
        completions,
        categories,
        settings?.weekStartsOnMonday ?? false,
      ),
    [items, completions, categories, settings?.weekStartsOnMonday],
  );

  const showReviewCta = shouldSuggestWeeklyReview(
    new Date(),
    settings?.weekStartsOnMonday ?? false,
  );

  const pending = items.filter((i) => i.status === "pending").length;
  const done = items.filter((i) => i.status === "done").length;
  const total = items.length;

  return (
    <div>
      <PageHeader title="Insights" subtitle="This week" />

      {(showReviewCta || weeklyReview.sections.length > 0) && (
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="btn-primary mb-4 w-full rounded-xl py-3 text-sm"
        >
          Start weekly review
        </button>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          label="Done this week"
          value={insights.completions}
          to="/history"
        />
        <StatCard label="Streak" value={`${insights.streakDays}d`} />
        <StatCard
          label="Pending"
          value={pending}
          to="/search?status=pending"
        />
        <StatCard label="Completed" value={done} to="/search?status=done" />
      </div>

      {insights.busiestDay && (
        <p className="text-muted mb-4 text-sm">
          Busiest day:{" "}
          <span className="text-primary">
            {format(new Date(insights.busiestDay), "EEEE, MMM d")}
          </span>
        </p>
      )}

      <section className="mb-6">
        <h2 className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
          By type this week
        </h2>
        <div className="space-y-2">
          {(
            Object.keys(ITEM_TYPE_LABELS) as Array<
              keyof typeof ITEM_TYPE_LABELS
            >
          ).map((type) => (
            <div
              key={type}
              className="bg-zinc-950 flex items-center justify-between rounded-xl px-4 py-3"
            >
              <TypeBadge type={type} />
              <span className="text-primary font-medium">
                {insights.completionsByType[type]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {insights.completionsByCategory.length > 0 && (
        <section className="mb-6">
          <h2 className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">
            By category this week
          </h2>
          <div className="space-y-2">
            {insights.completionsByCategory.map(({ category, count }) => (
              <div
                key={category.id}
                className="bg-zinc-950 flex items-center justify-between rounded-xl px-4 py-3"
              >
                <CategoryBadge category={category} size="md" />
                <span className="text-primary font-medium">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-zinc-900 bg-zinc-950/50 rounded-xl border p-4">
        <h2 className="mb-2 font-semibold">Overview</h2>
        <p className="text-muted text-sm">
          {total} items · {completions.length} completions logged
        </p>
      </section>

      {reviewOpen && (
        <WeeklyReviewSheet
          review={weeklyReview}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  to,
}: {
  label: string;
  value: string | number;
  to?: string;
}) {
  const content = (
    <>
      <p className="section-label">{label}</p>
      <p className="page-title mt-2 text-3xl">{value}</p>
    </>
  );

  if (!to) {
    return <div className="glass-card rounded-2xl p-4">{content}</div>;
  }

  return (
    <Link
      to={to}
      className="glass-card glass-card-hover block rounded-2xl p-4 active:opacity-90"
    >
      {content}
    </Link>
  );
}
