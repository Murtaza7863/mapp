import { Link } from "react-router-dom";

import type { Item } from "../types";

import {
  computeProgress,
  nextExamCountdown,
  type ProjectProgress,
} from "../lib/projects";

interface Props {
  item: Item;
  progress: ProjectProgress;
  to: string;
  subtitle?: string;
  allItems?: Item[];
}

export function ContainerCard({
  item,
  progress,
  to,
  subtitle,
  allItems,
}: Props) {
  const exam =
    allItems && item.type === "project"
      ? nextExamCountdown(item, allItems)
      : null;

  return (
    <Link
      to={to}
      className="item-card glass-card-hover block rounded-xl px-4 py-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-zinc-100 truncate text-[15px] font-medium">
            {item.title}
          </h3>
          {subtitle && (
            <p className="text-zinc-500 mt-0.5 text-[11px]">{subtitle}</p>
          )}
          {exam && (
            <p className="text-amber-400/90 mt-0.5 text-[11px]">
              {exam.title} in {exam.days <= 0 ? "today" : `${exam.days}d`}
            </p>
          )}
          {item.notes && (
            <p className="text-zinc-600 mt-1 line-clamp-1 text-[11px]">
              {item.notes}
            </p>
          )}
        </div>
        <span className="text-zinc-500 shrink-0 text-[11px] tabular-nums">
          {progress.label}
        </span>
      </div>
      <div className="bg-white/5 mt-2.5 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-sky-500/80 h-full rounded-full transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </Link>
  );
}

export function containerProgress(item: Item, items: Item[]): ProjectProgress {
  return computeProgress(item, items);
}
