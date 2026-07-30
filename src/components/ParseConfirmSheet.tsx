import { format, parseISO } from "date-fns";

import type {
  ProposedFeatureAction,
  ProposedItem,
} from "../lib/brain-dump/types";
import type { Category } from "../types";

import { featureLabel } from "../lib/brain-dump/features";
import { ITEM_TYPE_LABELS } from "../types";
import { DatePickerField } from "./DatePickerField";

interface Props {
  sourceText?: string;
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
  refining?: boolean;
}

function formatResolved(iso: string): string {
  return format(parseISO(iso), "EEE MMM d · h:mm a");
}

function isCreateKind(kind: ProposedFeatureAction["kind"]): boolean {
  return kind === "create_folder" || kind === "create_area";
}

export function ParseConfirmSheet({
  sourceText,
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
  refining,
}: Props) {
  const selectedItems = items.filter((i) => i.selected).length;
  const selectedActions = actions.filter((a) => a.selected).length;
  const selectedCount = selectedItems + selectedActions;
  const hasControl = actions.some((a) => a.selected && !isCreateKind(a.kind));
  const hasCreate =
    selectedItems > 0 ||
    actions.some((a) => a.selected && isCreateKind(a.kind));

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
    if (selectedCount === 0) return "Skip";
    if (hasControl && !hasCreate) {
      return `Apply ${selectedActions} change${selectedActions === 1 ? "" : "s"}`;
    }
    if (hasControl && hasCreate) {
      return `Apply ${selectedCount}`;
    }
    const parts: string[] = [];
    if (selectedItems > 0) {
      parts.push(`${selectedItems} item${selectedItems === 1 ? "" : "s"}`);
    }
    const createActions = actions.filter(
      (a) => a.selected && isCreateKind(a.kind),
    ).length;
    if (createActions > 0) {
      parts.push(
        `${createActions} folder${createActions === 1 ? "" : "s"}/area${createActions === 1 ? "" : "s"}`,
      );
    }
    return `Add ${parts.join(" + ")}`;
  })();

  const sheetTitle =
    hasControl && !hasCreate ? "Check before applying" : "Check before adding";

  return (
    <div
      className="bg-overlay fixed inset-0 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="modal-sheet max-h-[85dvh] w-full overflow-y-auto rounded-t-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-accent-bar rounded-t-xl" />
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-primary text-lg font-semibold">
                  {sheetTitle}
                </h3>
                {source === "llm" && !refining && (
                  <span className="ai-confirm-badge">On-device</span>
                )}
              </div>
              <p className="text-muted mt-1 text-xs">
                {refining
                  ? "Refining on-device…"
                  : "Edit anything that looks off."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted text-sm"
            >
              Cancel
            </button>
          </div>

          {sourceText && (
            <p className="text-muted border-rule bg-paper mb-4 rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed italic">
              {sourceText}
            </p>
          )}

          {clarifications.length > 0 && (
            <div className="text-warn border-rule bg-paper mb-4 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
              {clarifications.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {actions.map((action) => {
              const needsTarget = Boolean(action.targetQuery);
              const needsDue =
                action.kind === "snooze_item" ||
                (action.kind === "update_item" &&
                  (action.dueAt || action.patch?.dueAt));
              const ambiguous =
                !action.resolvedItemId &&
                (action.matchCandidates?.length ?? 0) > 0;

              return (
                <div key={action.id} className="item-card rounded-lg p-3.5">
                  <div className="mb-2 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={action.selected}
                      disabled={
                        needsTarget && !action.resolvedItemId && !ambiguous
                      }
                      onChange={(e) =>
                        updateAction(action.id, {
                          selected: e.target.checked,
                        })
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      {isCreateKind(action.kind) ? (
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
                      ) : (
                        <p className="text-primary text-sm font-medium">
                          {action.title}
                        </p>
                      )}

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

                      {ambiguous && action.matchCandidates && (
                        <select
                          value={action.resolvedItemId ?? ""}
                          onChange={(e) => {
                            const id = e.target.value;
                            const match = action.matchCandidates?.find(
                              (m) => m.id === id,
                            );
                            updateAction(action.id, {
                              resolvedItemId: id || undefined,
                              title: match?.title ?? action.title,
                              selected: Boolean(id),
                              navigateTo:
                                action.kind === "navigate" && id
                                  ? `/?item=${id}`
                                  : action.navigateTo,
                              summary: id
                                ? action.summary
                                    .replace(/—.+$/, "")
                                    .replace(
                                      /“.+”/,
                                      `“${match?.title ?? action.title}”`,
                                    )
                                : action.summary,
                            });
                          }}
                          className="input-field w-full rounded-lg px-2 py-2 text-xs"
                        >
                          <option value="">Pick which task…</option>
                          {action.matchCandidates.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.title}
                            </option>
                          ))}
                        </select>
                      )}

                      {needsDue && (
                        <DatePickerField
                          value={
                            (action.dueAt ?? action.patch?.dueAt)?.slice(
                              0,
                              10,
                            ) ?? ""
                          }
                          onChange={(date) => {
                            const time =
                              (action.dueAt ?? action.patch?.dueAt)?.slice(
                                11,
                                16,
                              ) ?? "09:00";
                            const iso = date
                              ? new Date(`${date}T${time}:00`).toISOString()
                              : undefined;
                            updateAction(action.id, {
                              dueAt: iso,
                              patch: action.patch
                                ? { ...action.patch, dueAt: iso ?? null }
                                : undefined,
                            });
                          }}
                          placeholder={
                            action.kind === "snooze_item"
                              ? "Snooze until"
                              : "New due date"
                          }
                          className="text-xs"
                        />
                      )}

                      {action.kind === "update_item" &&
                        action.patch?.categoryHint && (
                          <select
                            value={
                              action.patch.categoryId ?? action.categoryId ?? ""
                            }
                            onChange={(e) =>
                              updateAction(action.id, {
                                categoryId: e.target.value,
                                patch: {
                                  ...action.patch,
                                  categoryId: e.target.value,
                                },
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

                      <p className="text-muted text-[11px]">
                        {featureLabel(action.kind)} · {action.summary}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {items.map((item) => (
              <div key={item.id} className="item-card rounded-lg p-3.5">
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
                    {item.dueAt && (
                      <div className="resolve-row is-settled">
                        <span className="resolve-token-done">
                          {formatResolved(item.dueAt)}
                        </span>
                      </div>
                    )}
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
                    {(item.priority || item.parentFolderName) && (
                      <div className="text-muted flex flex-wrap gap-2 text-[11px]">
                        {item.priority && <span>Priority</span>}
                        {item.parentFolderName && (
                          <span>in {item.parentFolderName}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={saving || selectedCount === 0}
            onClick={onConfirm}
            className="btn-primary mt-5 w-full rounded-lg py-3.5 text-sm font-medium disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
