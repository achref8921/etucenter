"use client";

import { useEffect } from "react";

const RELOAD_KEY = "etudnet:sw-reload-at";

function reloadOnce() {
  const now = Date.now();
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (now - last < 15000) return;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {}
  window.location.reload();
}

export default function PwaRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    const hadController = Boolean(navigator.serviceWorker.controller);
    let registration: ServiceWorkerRegistration | null = null;
    let refreshing = false;

    const onControllerChange = () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      reloadOnce();
    };

    const onMessage = (event: MessageEvent) => {
      if (!hadController || refreshing) return;
      if (event.data?.type !== "SW_UPDATED") return;
      refreshing = true;
      reloadOnce();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reloadOnce();
    };

    const checkForUpdate = () => {
      if (!registration || document.visibilityState !== "visible" || !navigator.onLine) return;
      registration.update().catch(() => {});
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        return reg.update().catch(() => {});
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return null;
}
