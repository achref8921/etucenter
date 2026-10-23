"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

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
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-orange-50 px-4 py-2 text-center text-[13px] font-medium text-orange-800 dark:bg-orange-500/10 dark:text-orange-300"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">Connexion indisponible — certaines données peuvent être absentes.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-semibold underline-offset-2 hover:underline"
      >
        <RefreshCw className="h-3 w-3" />
        Réessayer
      </button>
    </div>
  );
}