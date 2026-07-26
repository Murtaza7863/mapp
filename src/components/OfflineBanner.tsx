import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="bg-amber-950/90 text-amber-200 border-amber-500/20 -mx-4 mb-3 border-b px-4 py-2 text-center text-xs"
      role="status"
    >
      Offline — changes save on this device. Push sync resumes when online.
    </div>
  );
}
