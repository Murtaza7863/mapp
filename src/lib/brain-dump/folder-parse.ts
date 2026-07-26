import type { Category } from "../../types";

import { parseContainerQuickAdd } from "../containers";

const TYPE_PREFIX_RE =
  /^(?:note|task|deadline|routine|follow[- ]?up|fu|project|jot down|write down|capture|http|https):/i;

export interface FolderTaskParse {
  folderName: string;
  taskTitle: string;
  childGroup?: string;
}

/** `Smubia: visa checklist` or `CS Homework: problem set 3` when subgroups exist. */
export function parseFolderTaskLine(
  line: string,
  category?: Category,
): FolderTaskParse | null {
  const trimmed = line.trim();
  if (!trimmed.includes(":") || TYPE_PREFIX_RE.test(trimmed)) return null;

  const subgroups = category?.subgroups ?? [];
  if (subgroups.length > 0) {
    const container = parseContainerQuickAdd(trimmed, subgroups);
    if (container) {
      return {
        folderName: container.folderName,
        taskTitle: container.taskTitle,
        childGroup: container.childGroup,
      };
    }
  }

  const simple = trimmed.match(/^([^:]{2,60}):\s+(.+)$/);
  if (!simple) return null;

  const folderName = simple[1].trim();
  const taskTitle = simple[2].trim();
  if (!folderName || !taskTitle || taskTitle.length < 2) return null;
  if (/^(create|make|add|new)\b/i.test(folderName)) return null;

  return { folderName, taskTitle };
}
