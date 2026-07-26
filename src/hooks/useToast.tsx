import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (
    message: string,
    options?: Partial<Omit<Toast, "id" | "message">>,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "message">>) => {
      const id = crypto.randomUUID();
      const entry: Toast = {
        id,
        message,
        kind: options?.kind ?? "info",
        action: options?.action,
      };
      setToasts((t) => [...t.slice(-2), entry]);
      window.setTimeout(() => dismiss(id), options?.action ? 5000 : 3000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${
              t.kind === "success"
                ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-100"
                : t.kind === "error"
                  ? "border-red-500/30 bg-red-950/90 text-red-100"
                  : "border-white/10 bg-zinc-950/95 text-zinc-100"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="text-sky-300 shrink-0 text-xs font-semibold"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
