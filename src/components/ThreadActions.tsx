import type { Item, PipelineStage } from "../types";

import {
  applyThreadStage,
  THREAD_QUICK_ACTIONS,
} from "../lib/thread-actions";
import { PIPELINE_STAGE_LABELS } from "../types";

interface Props {
  item: Item;
  onUpdate: (changes: Partial<Item>) => void;
}

export function ThreadActions({ item, onUpdate }: Props) {
  if (item.type !== "follow-up" || item.status === "done") return null;

  const apply = (stage: PipelineStage, bumpContact?: boolean, scheduleCheckBack?: boolean) => {
    const action = THREAD_QUICK_ACTIONS.find(
      (a) =>
        a.stage === stage &&
        !!a.bumpContact === !!bumpContact &&
        !!a.scheduleCheckBack === !!scheduleCheckBack,
    );
    if (!action) return;
    onUpdate(applyThreadStage(item, action));
  };

  return (
    <div className="flex flex-wrap gap-1.5 pr-1 pb-2 pl-9">
      {THREAD_QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() =>
            apply(action.stage, action.bumpContact, action.scheduleCheckBack)
          }
          className={`min-h-[36px] rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
            item.pipelineStage === action.stage
              ? "bg-violet-500/20 text-violet-200"
              : "bg-white/5 text-zinc-400 active:bg-white/10"
          }`}
        >
          {action.label}
        </button>
      ))}
      {item.pipelineStage && (
        <span className="text-zinc-600 self-center text-[10px]">
          {PIPELINE_STAGE_LABELS[item.pipelineStage]}
        </span>
      )}
    </div>
  );
}
