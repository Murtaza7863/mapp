import type { Category, Item, ItemInput } from "../../types";

import type { ProposedItem } from "./types";

type AddItemFn = (
  input: Partial<ItemInput> & { title: string },
) => Promise<Item>;

export async function applyProposals(
  proposals: ProposedItem[],
  categories: Category[],
  addItem: AddItemFn,
): Promise<Item[]> {
  const created: Item[] = [];

  for (const proposal of proposals) {
    if (!proposal.selected || !proposal.title.trim()) continue;

    const categoryId =
      proposal.categoryId ??
      categories.find(
        (c) =>
          proposal.categoryHint &&
          c.name.toLowerCase().startsWith(proposal.categoryHint.toLowerCase()),
      )?.id ??
      categories[0]?.id ??
      "";

    const item = await addItem({
      title: proposal.title.trim(),
      type: proposal.type,
      categoryId,
      dueAt: proposal.dueAt,
      priority: proposal.priority,
      notes: proposal.notes,
      contactName: proposal.contactName,
      pipelineStage:
        proposal.pipelineStage ??
        (proposal.type === "follow-up" ? "outreach" : undefined),
      ...(proposal.type === "follow-up"
        ? { lastContactAt: new Date().toISOString() }
        : {}),
    });

    created.push(item);
  }

  return created;
}
