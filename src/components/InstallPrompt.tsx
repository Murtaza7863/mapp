import { useEffect, useState } from "react";

import { CloseIcon } from "./icons";

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as { standalone?: boolean }).standalone);
    const dismissed = localStorage.getItem("install-prompt-dismissed");
    setShow(ios && !standalone && !dismissed);
  }, []);

  if (!show) return null;

  return (
    <div className="glass-card overflow-hidden rounded-lg border-l-2 border-l-mark">
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-primary text-sm font-semibold">Install mApp</p>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("install-prompt-dismissed", "1");
              setShow(false);
            }}
            className="text-muted hover:text-muted transition-colors"
            aria-label="Dismiss"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="text-muted text-xs leading-relaxed">
          Safari: Share → Add to Home Screen to install mApp. Required for
          notifications on iPhone.
        </p>
      </div>
    </div>
  );
}
