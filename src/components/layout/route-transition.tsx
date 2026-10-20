"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SplashScreen from "@/components/splash-screen";

/**
 * Voile d'attente affiché pendant les transitions de navigation interne
 * (clic sur un lien, bouton retour/avant, `router.push`).
 *
 * Fonctionnement : on intercepte les clics sur les liens internes et les
 * changements d'historique, on affiche le splash, puis on le masque dès que le
 * chemin change. Un délai minimal évite un flash trop bref et un délai maximal
 * garantit que le voile ne reste jamais bloqué.
 */
export default function RouteTransition() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (maxTimer.current) window.clearTimeout(maxTimer.current);
      hideTimer.current = null;
      maxTimer.current = null;
    };

    const show = () => {
      clearTimers();
      setVisible(true);
      maxTimer.current = window.setTimeout(() => setVisible(false), 8000);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      show();
    };

    const onPopState = () => show();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), 220);
  }, [pathname, visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9998] animate-fade-in motion-reduce:animate-none">
      <SplashScreen />
    </div>
  );
}
