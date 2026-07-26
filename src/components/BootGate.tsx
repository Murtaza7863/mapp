import { useEffect, useState } from "react";

import { seedDatabase } from "../db";
import {
  requestPersistentStorage,
  restoreFromAutoBackup,
  shouldOfferBackupRestore,
} from "../lib/persistence";

type BootState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "restore-prompt" }
  | { status: "error"; message: string };

export function BootGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BootState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await seedDatabase();
        await requestPersistentStorage();
        const offerRestore = await shouldOfferBackupRestore();
        if (cancelled) return;
        if (offerRestore) {
          setState({ status: "restore-prompt" });
        } else {
          setState({ status: "ready" });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Could not open your data",
        });
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="border-rule h-8 w-8 animate-spin rounded-full border-2 border-t-mark" />
        <p className="text-muted text-sm">Loading mApp…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-primary text-lg font-semibold">
          Could not open database
        </p>
        <p className="text-muted text-sm leading-relaxed">{state.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary rounded-xl px-6 py-3"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.status === "restore-prompt") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-primary text-lg font-semibold">Restore backup?</p>
        <p className="text-muted text-sm leading-relaxed">
          Your task list looks empty, but an auto-backup was found on this
          device.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await restoreFromAutoBackup();
                setState({ status: "ready" });
              } catch (err) {
                setState({
                  status: "error",
                  message:
                    err instanceof Error ? err.message : "Restore failed",
                });
              }
            }}
            className="btn-primary rounded-xl py-3"
          >
            Restore auto-backup
          </button>
          <button
            type="button"
            onClick={() => setState({ status: "ready" })}
            className="btn-ghost rounded-xl py-3"
          >
            Start fresh
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
