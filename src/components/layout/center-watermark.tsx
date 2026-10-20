"use client";

import { CSSProperties, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "watermark:enabled";
const EVENT = "watermark:changed";

export function useWatermarkEnabled() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) !== "0");
    } catch {}
    const onChange = () => {
      try {
        setEnabled(localStorage.getItem(STORAGE_KEY) !== "0");
      } catch {}
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      window.dispatchEvent(new Event(EVENT));
      return next;
    });
  };

  return { enabled, toggle };
}

/**
 * Filigrane (logo du centre) répété (mosaïque) sur toute la surface de la zone
 * de contenu : le logo reste net (crisp), sans flou.
 * - mosaïque couvrant toute la hauteur, y compris les pages longues ;
 * - opacité très faible => jamais gênant pour la lecture ;
 * - motif discret en mode clair (légèrement désaturé) et inversé en mode sombre ;
 * - non cliquable, ignoré des lecteurs d'écran, derrière tout le contenu ;
 * - activation mémorisée dans localStorage par navigateur.
 */
export default function CenterWatermark({
  logo,
  className,
}: {
  logo?: string | null;
  className?: string;
}) {
  const { enabled } = useWatermarkEnabled();

  if (!logo || !enabled) return null;

  const style: CSSProperties = {
    backgroundImage: `url("${logo}")`,
    backgroundRepeat: "repeat",
    backgroundSize: "clamp(72px, 9vw, 150px) auto",
    backgroundPosition: "center",
  };

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-0", className)}>
      <div
        aria-hidden="true"
        className={cn(
          "h-full w-full",
          "opacity-[0.045] dark:opacity-[0.06]",
          "grayscale-[0.4] dark:grayscale-0 dark:invert",
          "transition-opacity duration-500"
        )}
        style={style}
      />
    </div>
  );
}


