import type { MomentumSummary } from "../lib/momentum";

interface Props {
  momentum: MomentumSummary;
}

export function MomentumBar({ momentum }: Props) {
  if (momentum.doneToday === 0 && momentum.streakDays <= 1) return null;

  const parts: string[] = [];
  if (momentum.doneToday > 0) {
    parts.push(`${momentum.doneToday} done today`);
  }
  if (momentum.streakDays > 1) {
    parts.push(`${momentum.streakDays}-day streak`);
  }
  if (momentum.topRoutine && momentum.topRoutine.streak > 1) {
    parts.push(`${momentum.topRoutine.title} ${momentum.topRoutine.streak}🔥`);
  }

  return (
    <div className="momentum-bar mb-3 rounded-xl px-3 py-2 text-center text-xs font-medium">
      {parts.join(" · ")}
    </div>
  );
}
