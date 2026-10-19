"use client";

import { useEffect, useState } from "react";
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
 * Filigrane (logo du centre) affiché en fond de la zone de contenu.
 * - opacité très faible, désaturé, non cliquable, derrière tout le contenu ;
 * - s'adapte au mode clair/sombre ;
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

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden",
        className
      )}
    >
      <img
        src={logo}
        alt=""
        draggable={false}
        className={cn(
          "select-none object-contain",
          "h-[62vh] w-auto max-w-[78%] -translate-y-2",
          "opacity-[0.05] dark:opacity-[0.06]",
          "grayscale dark:grayscale-0",
          "transition-opacity duration-500"
        )}
      />
    </div>
  );
}

