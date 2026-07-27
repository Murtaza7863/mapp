import type { ItemType } from "../types";

import { ITEM_TYPE_LABELS } from "../types";

interface Props {
  type: ItemType;
}

const TYPE_STYLES: Record<ItemType, string> = {
  deadline: "text-amber-800 bg-amber-50 border-amber-200",
  routine: "text-sky-800 bg-sky-50 border-sky-200",
  "follow-up": "text-block bg-sky-50 border-sky-200",
  note: "text-muted bg-paper border-rule",
  project: "text-emerald-800 bg-emerald-50 border-emerald-200",
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
