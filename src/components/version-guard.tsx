"use client";

import { useEffect } from "react";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
const RELOAD_KEY = "etudnet:version-reload-at";

function reloadOnce() {
  const now = Date.now();
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (now - last < 30000) return;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {}
  window.location.reload();
}

export default function VersionGuard() {
  useEffect(() => {
    if (BUILD_ID === "dev" || typeof window === "undefined") return;

    let checking = false;

    const checkVersion = async () => {
      if (checking || document.visibilityState !== "visible" || !navigator.onLine) return;
      checking = true;
      try {
        const res = await fetch("/api/version", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.buildId && data.buildId !== BUILD_ID) reloadOnce();
      } catch {
        // Réseau indisponible : on réessaiera à la prochaine ouverture.
      } finally {
        checking = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };

    void checkVersion();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = window.setInterval(checkVersion, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
