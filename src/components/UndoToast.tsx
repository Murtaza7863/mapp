import { useUndo } from "../hooks/useUndo";

export function UndoToast() {
  const { undoMessage, undo } = useUndo();
  if (!undoMessage) return null;

  return (
    <div className="undo-toast fixed z-50 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <span className="truncate text-sm text-white/90">{undoMessage}</span>
      <button
        type="button"
        onClick={undo}
        className="btn-primary shrink-0 rounded-xl px-4 py-1.5 text-sm"
      >
        Undo
      </button>
    </div>
  );
}
