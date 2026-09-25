"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/analytics";

const IGNORED_PATH_PREFIXES = ["/api/", "/_next/", "/super-admin/usage"];

function shouldTrack(path: string): boolean {
  if (!path || path.startsWith("/login")) return false;
  return !IGNORED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export default function UsageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const lastHeartbeatRef = useRef<number>(0);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const post = (payload: Record<string, unknown>) => {
      try {
        void fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, sessionId: sessionIdRef.current }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    const start = () =>
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
        keepalive: true,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.sessionId) sessionIdRef.current = d.sessionId;
        })
        .catch(() => {});

    void start();

    const onActivity = () => {
      const now = Date.now();
      if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return;
      lastHeartbeatRef.current = now;
      post({ action: "heartbeat" });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onActivity();
    };

    const onUnload = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const url = "/api/analytics/track";
      const body = JSON.stringify({ action: "end", sessionId, reason: "unload" });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        } else {
          void fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    const heartbeat = window.setInterval(onActivity, HEARTBEAT_INTERVAL_MS);

    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onUnload);
    };
  }, []);

  useEffect(() => {
    if (!pathname || !shouldTrack(pathname)) return;
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    try {
      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "page_view", path, sessionId: sessionIdRef.current }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [pathname, searchParams]);

  return null;
}
