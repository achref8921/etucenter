"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOffline(!navigator.onLine);

    const on = () => setOffline(false);
    const off = () => setOffline(true);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const onServiceMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "OFFLINE_SERVE") {
        setOffline(true);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onServiceMessage);
    }

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onServiceMessage);
      }
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-orange-50 px-4 py-2 text-center text-[13px] font-medium text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Mode hors ligne — affichage des dernières données chargées.
    </div>
  );
}