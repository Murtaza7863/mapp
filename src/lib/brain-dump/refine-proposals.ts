import type { Category } from "../../types";
import { parseQuickAdd } from "../quickadd";

import { extractContact } from "./contacts";
import type { ProposedItem } from "./types";
import { inferTypeFromLine, stripTypePrefix } from "./rules-parser";
import {
  isValidTask,
  polishTitle,
  splitContextTaskLine,
} from "./title-cleanup";
import { resolveCategoryId } from "./validate";

const WORK_HINT =
  /\b(meeting|report|deck|interview|boss|client|submit|presentation|slides|professor|prof|homework|exam|class|lecture|assignment|ta\b)/i;
const PERSONAL_HINT =
  /\b(gym|mom|dad|rent|groceries|doctor|dentist|workout|grocer)/i;

function inferCategoryId(
  title: string,
  categories: Category[],
  hint?: string,
): string | undefined {
  const fromHint = resolveCategoryId(hint, categories);
  if (fromHint) return fromHint;

  const work = categories.find((c) => c.name.toLowerCase() === "work");
  const personal = categories.find((c) => c.name.toLowerCase() === "personal");

  if (WORK_HINT.test(title) && work) return work.id;
  if (PERSONAL_HINT.test(title) && personal) return personal.id;
  return categories[0]?.id;
}

/** Re-run quick-add parsing on titles to fix dates, areas, and cleanup. */
function refineProposal(
  item: ProposedItem,
  categories: Category[],
  sourceLine?: string,
  now: Date = new Date(),
): ProposedItem | null {
  const raw = sourceLine ?? item.title;
  const { taskLine, contextContact } = splitContextTaskLine(raw);
  const cleaned = stripTypePrefix(taskLine);
  const parseInput = item.structure?.taskText?.trim() || cleaned;
  const parsed = parseQuickAdd(parseInput, categories, now);
  const inferredType = item.type ?? inferTypeFromLine(taskLine);
  const type = parsed.type ?? inferredType;

  const contactName =
    item.contactName ?? contextContact ?? extractContact(taskLine);
  const categoryNames = categories.map((c) => c.name);
  const polished = polishTitle(
    parsed.title.trim() || item.title.trim(),
    parseInput,
    type,
    contactName,
    contextContact,
    categoryNames,
  );
  const title =
    polished.length >= 4 && !/^[\w\s]+ by$/i.test(polished)
      ? polished
      : item.title.trim();

  if (
    !isValidTask(taskLine, title, {
      dueAt: parsed.dueAt ?? item.dueAt,
      contactName,
      type,
    })
  ) {
    return null;
  }

  const matchedCategory = item.structure?.areaName
    ? categories.find(
        (c) => c.name.toLowerCase() === item.structure!.areaName!.toLowerCase(),
      )
    : undefined;

  const categoryId =
    parsed.categoryId ??
    item.categoryId ??
    matchedCategory?.id ??
    inferCategoryId(
      title,
      categories,
      item.categoryHint ?? parsed.categoryName,
    );

  return {
    ...item,
    title,
    type,
    categoryId,
    categoryHint: item.categoryHint ?? parsed.categoryName,
    parentFolderName: item.parentFolderName,
    childGroup: item.childGroup,
    structure: item.structure,
    planNotes: item.planNotes,
    dueAt: parsed.dueAt ?? item.dueAt,
    priority: parsed.priority || item.priority,
    contactName,
    pipelineStage:
      item.pipelineStage ?? (type === "follow-up" ? "outreach" : undefined),
  };
}

export function refineProposals(
  items: ProposedItem[],
  categories: Category[],
  sourceLines?: string[],
  now: Date = new Date(),
): ProposedItem[] {
  const refined: ProposedItem[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const polished = refineProposal(
      item,
      categories,
      sourceLines?.[index],
      now,
    );
    if (polished) refined.push(polished);
  }

  return refined;
}
