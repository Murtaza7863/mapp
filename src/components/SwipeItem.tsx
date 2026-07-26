import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useRef, useState } from "react";

import type { Category, Item } from "../types";

import { getChildGroup } from "../lib/containers";
import { formatDue, formatSnoozedUntil, isOverdue } from "../lib/dates";
import { formatDeadlineDate } from "../lib/event-deadlines";
import { gpdDueFromEvent, stageLabel } from "../lib/pipeline";
import { ITEM_TYPE_LABELS } from "../types";
import { CheckIcon, ClockIcon, CloseIcon, StarIcon } from "./icons";

interface Props {
  item: Item;
  category?: Category;
  parentFolderName?: string;
  onDone: () => void;
  onSnooze: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
  showType?: boolean;
}

export function SwipeItem({
  item,
  category,
  parentFolderName,
  onDone,
  onSnooze,
  onEdit,
  onDelete,
  compact,
  showType = false,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [completing, setCompleting] = useState(false);
  const startX = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    dragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const diff = e.touches[0].clientX - startX.current;
    setOffset(Math.max(-100, Math.min(100, diff)));
  };

  const onTouchEnd = () => {
    dragging.current = false;
    if (item.status === "done") {
      setOffset(0);
      return;
    }
    if (offset > 72) {
      complete();
      setOffset(0);
    } else if (offset < -72) {
      onSnooze();
      setOffset(0);
    } else {
      setOffset(0);
    }
  };

  const complete = () => {
    if (completing || item.status === "done") return;
    setCompleting(true);
    if ("vibrate" in navigator) navigator.vibrate?.(8);
    setTimeout(onDone, 280);
  };

  const overdue = item.status === "pending" && isOverdue(item);
  const snoozed = item.status === "snoozed";
  const accent = category?.color ?? "#52525b";
  const waitingDays =
    item.type === "follow-up"
      ? differenceInCalendarDays(
          new Date(),
          parseISO(item.lastContactAt ?? item.createdAt),
        )
      : null;
  const struck = completing || item.status === "done";

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="swipe-underlay bg-emerald-500/20 text-emerald-300 absolute inset-y-0 left-0 w-20 items-center justify-center text-[11px] font-medium">
        Done
      </div>
      <div className="swipe-underlay bg-amber-500/15 text-amber-200/90 absolute inset-y-0 right-0 w-20 items-center justify-center text-[11px] font-medium">
        {snoozed ? "Later" : "Snooze"}
      </div>
      <div
        className="item-card relative z-10 cursor-pointer overflow-hidden rounded-xl transition-transform duration-150 ease-out"
        style={{
          transform: `translateX(${offset}px)`,
          borderLeftWidth: 3,
          borderLeftColor: accent,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (Math.abs(offset) < 5) onEdit();
        }}
      >
        <div
          className={`flex items-start gap-3 ${compact ? "p-3" : "px-3.5 py-3"}`}
        >
          {item.type !== "note" && item.status !== "done" && (
            <button
              type="button"
              aria-label="Mark done"
              onClick={(e) => {
                e.stopPropagation();
                complete();
              }}
              className="check-circle mt-0.5 -ml-1 flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  completing ? "check-circle-done" : ""
                }`}
                style={{
                  borderColor: completing ? accent : `${accent}99`,
                  backgroundColor: completing ? accent : "transparent",
                }}
              >
                {completing && <CheckIcon className="text-white h-3 w-3" />}
              </span>
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {item.priority && (
                <StarIcon
                  filled
                  className="text-amber-500/90 h-3 w-3 shrink-0"
                />
              )}
              <h3
                className={`truncate text-[15px] leading-snug font-medium ${
                  struck ? "text-zinc-600 line-through" : "text-zinc-100"
                }`}
              >
                {item.title}
              </h3>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              {showType && item.type !== "follow-up" && (
                <span className="type-pill">{ITEM_TYPE_LABELS[item.type]}</span>
              )}
              {item.type === "follow-up" && item.pipelineStage && (
                <span className="text-zinc-500">
                  {stageLabel(item.pipelineStage)}
                </span>
              )}
              {snoozed && item.snoozedUntil && (
                <span className="text-amber-400/80">
                  {formatSnoozedUntil(item.snoozedUntil)}
                </span>
              )}
              {!snoozed && item.dueAt && (
                <span className={overdue ? "text-red-400/90" : "text-zinc-500"}>
                  {overdue ? "Overdue · " : ""}
                  {formatDue(item.dueAt)}
                </span>
              )}
              {getChildGroup(item) && (
                <span className="text-zinc-500">{getChildGroup(item)}</span>
              )}
              {parentFolderName && (
                <span className="text-zinc-500">in {parentFolderName}</span>
              )}
              {item.checkBackAt && item.type === "follow-up" && (
                <span className="text-violet-400/80">
                  Look back {format(parseISO(item.checkBackAt), "MMM d")}
                </span>
              )}
              {item.linkedEventAt && item.type === "follow-up" && (
                <span className="text-violet-400/70">
                  Prep{" "}
                  {formatDeadlineDate(
                    gpdDueFromEvent(item.linkedEventAt).toISOString(),
                  )}
                </span>
              )}
              {item.notificationsMuted && (
                <span className="text-zinc-600">muted</span>
              )}
              {category && (
                <span className="text-zinc-500">{category.name}</span>
              )}
              {waitingDays !== null && waitingDays > 0 && (
                <span
                  className={
                    waitingDays >= 7 ? "text-amber-400/90" : "text-zinc-600"
                  }
                >
                  {waitingDays}d waiting
                </span>
              )}
            </div>

            {(item.contactName || item.waitingOn) && (
              <p className="text-zinc-600 mt-0.5 truncate text-[11px]">
                {item.contactName ?? item.waitingOn}
              </p>
            )}
            {item.type === "follow-up" && item.nextAction && (
              <p className="text-amber-400/80 mt-0.5 truncate text-[11px]">
                → {item.nextAction}
              </p>
            )}
            {item.notes && !compact && (
              <p className="text-zinc-600 mt-0.5 line-clamp-1 text-[11px]">
                {item.notes}
              </p>
            )}
          </div>

          <div className="desktop-item-actions shrink-0">
            {item.status !== "done" && item.type !== "note" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSnooze();
                }}
                className="text-zinc-600 hover:text-amber-300 rounded p-1"
                aria-label="Snooze"
              >
                <ClockIcon className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-zinc-600 hover:text-zinc-400 rounded p-1"
              aria-label="Delete"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
