import { useEffect, useState } from "react";

import { APP_NAME } from "../config";
import { CloseIcon } from "./icons";

const DISMISS_KEY = "install-prompt-dismissed";
const VISITS_KEY = "install-prompt-visits";

/** Storage throws in iOS private mode — never let a banner take down the app. */
function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * Soft install tip for iOS Safari. Skips the first open so Plot gets the
 * spotlight, then shows a one-line banner until dismissed.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as { standalone?: boolean }).standalone);
    if (!ios || standalone) return;
    if (readFlag(DISMISS_KEY)) return;

    const visits = Number(readFlag(VISITS_KEY) ?? "0") + 1;
    writeFlag(VISITS_KEY, String(visits));
    setShow(visits >= 2);
  }, []);

  if (!show) return null;

  return (
    <div className="border-rule bg-surface mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5">
      <p className="text-muted min-w-0 flex-1 text-xs leading-relaxed">
        <span className="text-primary font-medium">Install {APP_NAME}.</span>{" "}
        Safari → Share → Add to Home Screen. Needed for notifications.
      </p>
      <button
        type="button"
        onClick={() => {
          writeFlag(DISMISS_KEY, "1");
          setShow(false);
        }}
        className="text-muted shrink-0 p-0.5"
        aria-label="Dismiss"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
