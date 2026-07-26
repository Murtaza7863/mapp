import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import type { Item } from "../types";

interface UndoContextValue {
  deleteWithUndo: (
    item: Item,
    onDelete: (id: string) => Promise<Item | null>,
    onRestore: (item: Item) => Promise<void>,
  ) => Promise<void>;
  undoMessage: string | null;
  undo: () => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [undoMessage, setUndoMessage] = useState<string | null>(null);
  const pendingRef = useRef<{
    item: Item;
    restore: (item: Item) => Promise<void>;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setUndoMessage(null);
  }, []);

  const deleteWithUndo = useCallback(
    async (
      item: Item,
      onDelete: (id: string) => Promise<Item | null>,
      onRestore: (item: Item) => Promise<void>,
    ) => {
      clearUndo();
      const deleted = await onDelete(item.id);
      if (!deleted) return;
      pendingRef.current = { item: deleted, restore: onRestore };
      setUndoMessage(`Deleted "${deleted.title}"`);
      timerRef.current = setTimeout(clearUndo, 5000);
    },
    [clearUndo],
  );

  const undo = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    await pending.restore(pending.item);
    clearUndo();
  }, [clearUndo]);

  return (
    <UndoContext.Provider value={{ deleteWithUndo, undoMessage, undo }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo must be used within UndoProvider");
  return ctx;
}
