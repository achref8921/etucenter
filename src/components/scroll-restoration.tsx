"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const positions = new Map<string, number>();
const MAX_RESTORE_MS = 1500;
const WATCH_MS = 800;

function currentKey() {
  return window.location.pathname + window.location.search;
}

export default function ScrollRestoration() {
  const pathname = usePathname();
  const activeKeyRef = useRef<string>("");
  const rafRef = useRef(0);

  useEffect(() => {
    activeKeyRef.current = currentKey();

    const save = () => {
      rafRef.current = 0;
      const key = currentKey();
      if (key !== activeKeyRef.current) return;
      positions.set(key, window.scrollY);
    };
    const onScroll = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    const restore = (key: string, y: number) => {
      const started = performance.now();
      let done = false;
      const apply = () => {
        if (currentKey() !== key || window.location.hash) return;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll >= y - 1) {
          window.scrollTo(0, y);
          if (Math.abs(window.scrollY - y) <= 1) {
            done = true;
            return;
          }
        }
        if (performance.now() - started < MAX_RESTORE_MS) {
          requestAnimationFrame(apply);
        }
      };
      requestAnimationFrame(apply);
      // Next can scroll to the top AFTER a successful restore (route
      // transition effects). Keep a short watch and re-apply once.
      const watchStart = performance.now();
      const watch = () => {
        if (currentKey() !== key) return;
        if (done && window.scrollY === 0 && document.documentElement.scrollHeight > y) {
          window.scrollTo(0, y);
        }
        if (performance.now() - watchStart < WATCH_MS) requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    };

    const onPopState = () => {
      if (window.location.hash) return;
      const key = currentKey();
      const y = positions.get(key);
      if (y === undefined || y === 0) return;
      restore(key, y);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
