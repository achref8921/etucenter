"use client";

import { cn } from "@/lib/utils";
import { useCachedLogo } from "@/lib/branding-cache";

/**
 * Écran d'attente professionnel (splash).
 * - utilise le logo fourni (logo du centre) ou, par défaut, le logo du site ;
 *   si aucun logo n'est fourni, reprend le dernier logo de centre mémorisé ;
 * - anneau lumineux animé + léger pulsé du logo + barre de progression indéterminée ;
 * - respecte `prefers-reduced-motion` (animations désactivées) ;
 * - plein écran, non bloquant pour le lecteur d'écran (`role="status"`).
 */
export default function SplashScreen({
  logo,
  label = "Chargement en cours…",
  fullScreen = true,
  className,
}: {
  logo?: string | null;
  label?: string;
  fullScreen?: boolean;
  className?: string;
}) {
  const cachedLogo = useCachedLogo();
  const src = logo || cachedLogo || "/logo.svg";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex w-full items-center justify-center bg-[var(--background)]",
        fullScreen ? "fixed inset-0 z-[9998] min-h-screen" : "py-16",
        className
      )}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-28 w-28 items-center justify-center">
          {/* Halo dégradé qui tourne */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 rounded-full",
              "bg-[conic-gradient(from_0deg,transparent_0deg,rgba(29,78,216,0.85)_140deg,rgba(59,130,246,0)_320deg)]",
              "animate-[spin_1.05s_linear_infinite] motion-reduce:animate-none",
              "dark:bg-[conic-gradient(from_0deg,transparent_0deg,rgba(59,130,246,0.85)_140deg,rgba(96,165,250,0)_320deg)]"
            )}
          />
          {/* Disque intérieur qui masque le centre du halo */}
          <span
            aria-hidden="true"
            className="absolute inset-[3px] rounded-full bg-[var(--background)]"
          />
          {/* Logo au centre */}
          <img
            src={src}
            alt=""
            draggable={false}
            className={cn(
              "relative h-16 w-16 select-none object-contain",
              "animate-[splash-pulse_1.6s_ease-in-out_infinite] motion-reduce:animate-none"
            )}
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium tracking-wide text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          {/* Barre de progression indéterminée */}
          <div className="h-1 w-40 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-[#232732]">
            <span
              aria-hidden="true"
              className={cn(
                "block h-full w-1/3 rounded-full bg-blue-600 dark:bg-blue-500",
                "animate-[splash-bar_1.15s_ease-in-out_infinite] motion-reduce:animate-none"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
