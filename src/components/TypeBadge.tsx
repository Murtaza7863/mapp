import type { ItemType } from "../types";

import { ITEM_TYPE_LABELS } from "../types";

interface Props {
  type: ItemType;
}

const TYPE_STYLES: Record<ItemType, string> = {
  deadline: "text-amber-300/90 bg-amber-400/10 border-amber-400/20",
  routine: "text-sky-300/90 bg-sky-400/10 border-sky-400/20",
  "follow-up": "text-violet-300/90 bg-violet-400/10 border-violet-400/20",
  note: "text-zinc-400 bg-white/5 border-white/10",
  project: "text-emerald-300/90 bg-emerald-400/10 border-emerald-400/20",
};

export function TypeBadge({ type }: Props) {
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${TYPE_STYLES[type]}`}
    >
      {ITEM_TYPE_LABELS[type]}
    </span>
  );
}
