import type { Item, PipelineStage } from "../types";

import { PIPELINE_STAGE_LABELS } from "../types";

const QUICK_ACTIONS: {
  label: string;
  stage: PipelineStage;
  bumpContact?: boolean;
}[] = [
  { label: "Bump sent", stage: "waiting", bumpContact: true },
  { label: "They replied", stage: "scheduling", bumpContact: true },
  { label: "Your turn", stage: "my_turn" },
  { label: "Revisit later", stage: "deferred" },
];

interface Props {
  item: Item;
  onUpdate: (changes: Partial<Item>) => void;
}

export function ThreadActions({ item, onUpdate }: Props) {
  if (item.type !== "follow-up" || item.status === "done") return null;

  const apply = (stage: PipelineStage, bumpContact?: boolean) => {
    const now = new Date().toISOString();
    onUpdate({
      pipelineStage: stage,
      ...(bumpContact ? { lastContactAt: now } : {}),
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5 pr-1 pb-2 pl-9">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => apply(action.stage, action.bumpContact)}
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
