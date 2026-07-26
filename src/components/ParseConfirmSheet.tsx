import { format, parseISO } from "date-fns";

import { featureLabel } from "../lib/brain-dump/features";
import type {
  ProposedFeatureAction,
  ProposedItem,
} from "../lib/brain-dump/types";
import type { Category } from "../types";

import { ITEM_TYPE_LABELS } from "../types";
import { DatePickerField } from "./DatePickerField";

interface Props {
  items: ProposedItem[];
  actions: ProposedFeatureAction[];
  clarifications: string[];
  source: "llm" | "rules";
  categories: Category[];
  onChangeItems: (items: ProposedItem[]) => void;
  onChangeActions: (actions: ProposedFeatureAction[]) => void;
  onConfirm: () => void;
  onClose: () => void;
  saving?: boolean;
}

export function ParseConfirmSheet({
  items,
  actions,
  clarifications,
  source,
  categories,
  onChangeItems,
  onChangeActions,
  onConfirm,
  onClose,
  saving,
}: Props) {
  const selectedItems = items.filter((i) => i.selected).length;
  const selectedActions = actions.filter((a) => a.selected).length;
  const selectedCount = selectedItems + selectedActions;

  const updateItem = (id: string, patch: Partial<ProposedItem>) => {
    onChangeItems(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const updateAction = (id: string, patch: Partial<ProposedFeatureAction>) => {
    onChangeActions(
      actions.map((action) =>
        action.id === id ? { ...action, ...patch } : action,
      ),
    );
  };

  const confirmLabel = (() => {
    if (saving) return "Saving…";
    const parts: string[] = [];
    if (selectedActions > 0) {
      parts.push(
        `${selectedActions} action${selectedActions === 1 ? "" : "s"}`,
      );
    }
    if (selectedItems > 0) {
      parts.push(`${selectedItems} item${selectedItems === 1 ? "" : "s"}`);
    }
    if (parts.length === 0) return "Add nothing";
    return `Add ${parts.join(" + ")}`;
  })();

  return (
    <div
      className="bg-black/70 fixed inset-0 z-50 flex items-end backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="modal-sheet max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-accent-bar rounded-t-3xl" />
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-zinc-100 text-lg font-semibold">
                Does this look right?
              </h3>
              <p className="text-zinc-500 mt-1 text-xs">
                {source === "llm"
                  ? "Plotted on-device"
                  : "Plotted with quick parse"}
                . Edit before saving.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 text-sm"
            >
              Cancel
            </button>
          </div>

          {clarifications.length > 0 && (
            <div className="border-amber-500/20 bg-amber-500/10 text-amber-200/90 mb-4 rounded-xl border px-3 py-2.5 text-xs leading-relaxed">
              {clarifications.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {actions.map((action) => (
              <div key={action.id} className="item-card rounded-2xl p-3.5">
                <div className="mb-2 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={action.selected}
                    onChange={(e) =>
                      updateAction(action.id, { selected: e.target.checked })
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={action.title}
                      onChange={(e) =>
                        updateAction(action.id, {
                          title: e.target.value,
                          summary:
                            action.kind === "create_folder"
                              ? `New folder “${e.target.value}”`
                              : `New area “${e.target.value}”`,
                        })
                      }
                      className="input-field w-full rounded-lg px-3 py-2 text-sm"
                    />
                    {action.kind === "create_folder" && (
                      <select
                        value={action.categoryId ?? ""}
                        onChange={(e) =>
                          updateAction(action.id, {
                            categoryId: e.target.value,
                          })
                        }
                        className="input-field w-full rounded-lg px-2 py-2 text-xs"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="text-zinc-500 flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-emerald-400/10 text-emerald-300 rounded-md px-2 py-1">
                        {featureLabel(action.kind)}
                      </span>
                      <span className="bg-white/5 rounded-md px-2 py-1">
                        {action.summary}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {items.map((item) => (
              <div key={item.id} className="item-card rounded-2xl p-3.5">
                <div className="mb-2 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) =>
                      updateItem(item.id, { selected: e.target.checked })
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={item.title}
                      onChange={(e) =>
                        updateItem(item.id, { title: e.target.value })
                      }
                      className="input-field w-full rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={item.type}
                        onChange={(e) =>
                          updateItem(item.id, {
                            type: e.target.value as ProposedItem["type"],
                          })
                        }
                        className="input-field rounded-lg px-2 py-2 text-xs"
                      >
                        {Object.entries(ITEM_TYPE_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <select
                        value={item.categoryId ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, { categoryId: e.target.value })
                        }
                        className="input-field rounded-lg px-2 py-2 text-xs"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <DatePickerField
                      value={item.dueAt ? item.dueAt.slice(0, 10) : ""}
                      onChange={(date) => {
                        const time = item.dueAt?.slice(11, 16) ?? "09:00";
                        updateItem(item.id, {
                          dueAt: date
                            ? new Date(`${date}T${time}:00`).toISOString()
                            : undefined,
                        });
                      }}
                      placeholder="Due date (optional)"
                      className="text-xs"
                    />
                    <div className="text-zinc-500 flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-white/5 rounded-md px-2 py-1">
                        {ITEM_TYPE_LABELS[item.type]}
                      </span>
                      {item.dueAt && (
                        <span className="bg-sky-400/10 text-sky-300 rounded-md px-2 py-1">
                          {format(parseISO(item.dueAt), "EEE MMM d, h:mm a")}
                        </span>
                      )}
                      {item.priority && (
                        <span className="bg-amber-400/10 text-amber-300 rounded-md px-2 py-1">
                          priority
                        </span>
                      )}
                      {item.parentFolderName && (
                        <span className="bg-sky-400/10 text-sky-300 rounded-md px-2 py-1">
                          in {item.parentFolderName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={saving || selectedCount === 0}
            onClick={onConfirm}
            className="btn-primary mt-5 w-full rounded-xl py-3.5 text-sm font-medium disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
