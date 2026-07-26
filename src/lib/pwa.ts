export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

/** iOS only delivers Web Push to Home Screen installs (iOS 16.4+). */
export function canUseWebPush(): boolean {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  if (isIos() && !isStandalone()) return false;
  return true;
}

export function pushBlockReason(): string | null {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "Push is not supported in this browser.";
  }
  if (isIos() && !isStandalone()) {
    return "On iPhone, add this app to your Home Screen first.";
  }
  return null;
}
