import { isSameDay, parseISO, startOfWeek, subDays } from "date-fns";

import type { CompletionLog, Item } from "../types";

export interface MomentumSummary {
  doneToday: number;
  doneThisWeek: number;
  streakDays: number;
  topRoutine?: { title: string; streak: number };
}

export function countCompletionsToday(
  completions: CompletionLog[],
  now = new Date(),
): number {
  return completions.filter((c) =>
    isSameDay(parseISO(c.completedAt), now),
  ).length;
}

export function computeCompletionStreak(
  completions: CompletionLog[],
  now = new Date(),
): number {
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const day = subDays(now, i);
    const has = completions.some((c) =>
      isSameDay(parseISO(c.completedAt), day),
    );
    if (has) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export function computeRoutineStreak(
  routine: Item,
  completions: CompletionLog[],
): number {
  if (routine.type !== "routine") return 0;
  const related = completions
    .filter((c) => c.itemId === routine.id)
    .sort(
      (a, b) =>
        parseISO(b.completedAt).getTime() - parseISO(a.completedAt).getTime(),
    );
  if (related.length === 0) return 0;

  let streak = 1;
  let prev = parseISO(related[0].completedAt);
  for (let i = 1; i < related.length; i++) {
    const day = parseISO(related[i].completedAt);
    const gap = Math.round(
      (prev.getTime() - day.getTime()) / 86_400_000,
    );
    if (gap <= 2) {
      streak++;
      prev = day;
    } else break;
  }
  return streak;
}

export function computeMomentum(
  items: Item[],
  completions: CompletionLog[],
  now = new Date(),
): MomentumSummary {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const doneToday = countCompletionsToday(completions, now);
  const doneThisWeek = completions.filter(
    (c) => parseISO(c.completedAt) >= weekStart,
  ).length;
  const streakDays = computeCompletionStreak(completions, now);

  const routines = items.filter(
    (i) => i.type === "routine" && i.status === "pending",
  );
  let topRoutine: MomentumSummary["topRoutine"];
  for (const routine of routines) {
    const streak = computeRoutineStreak(routine, completions);
    if (!topRoutine || streak > topRoutine.streak) {
      topRoutine = { title: routine.title, streak };
    }
  }

  return { doneToday, doneThisWeek, streakDays, topRoutine };
}
