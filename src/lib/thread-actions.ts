import { addDays } from "date-fns";

import type { Item, PipelineStage } from "../types";

import { STALE_DAYS } from "./pipeline";

export type ThreadQuickAction = {
  label: string;
  stage: PipelineStage;
  bumpContact?: boolean;
  scheduleCheckBack?: boolean;
};

export const THREAD_QUICK_ACTIONS: ThreadQuickAction[] = [
  {
    label: "Bump sent",
    stage: "waiting",
    bumpContact: true,
    scheduleCheckBack: true,
  },
  { label: "They replied", stage: "scheduling", bumpContact: true },
  { label: "Your turn", stage: "my_turn" },
  { label: "Revisit later", stage: "deferred", scheduleCheckBack: true },
];

export function applyThreadStage(
  _item: Item,
  action: ThreadQuickAction,
  now = new Date(),
): Partial<Item> {
  return {
    pipelineStage: action.stage,
    ...(action.bumpContact ? { lastContactAt: now.toISOString() } : {}),
    ...(action.scheduleCheckBack
      ? { checkBackAt: addDays(now, STALE_DAYS).toISOString() }
      : {}),
  };
}

export function findQuickAction(label: string): ThreadQuickAction | undefined {
  return THREAD_QUICK_ACTIONS.find((a) => a.label === label);
}
