"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SegmentedTabItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  /** "accent" pour un compteur d'attention (ex. non lus), "muted" pour une métadonnée. */
  badgeTone?: "accent" | "muted";
};

type SegmentedTabsProps = {
  items: SegmentedTabItem[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel: string;
  className?: string;
};

/**
 * Contrôle segmenté à indicateur coulissant.
 *
 * L'indicateur utilise un fond semi-transparent (effet verre) + un liseré
 * blanc intérieur, pour rester visible sans être un aplat opaque. Le texte
 * actif passe en blanc, l'icône s'anime au survol et le badge s'adapte.
 */
export function SegmentedTabs({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedTabsProps) {
  const count = Math.max(items.length, 1);
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === value)
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative flex gap-1 rounded-[var(--radius-lg)] bg-[var(--surface-muted)] p-1 ring-1 ring-border/70",
        className
      )}
    >
      <span
        aria-hidden="true"
        style={{
          width: `calc((100% - ${4 * (count + 1)}px) / ${count})`,
          transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
        }}
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 rounded-[var(--radius-md)]",
          "bg-primary/45 bg-gradient-to-br from-white/[0.16] via-white/[0.03] to-transparent",
          "shadow-[0_10px_24px_-14px_var(--primary)] ring-1 ring-inset ring-white/20",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        )}
      />

      {items.map((item) => {
        const active = item.key === value;
        const tone = item.badgeTone ?? "muted";

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "group relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[11.5px] font-semibold",
              "transition-colors duration-300 ease-out",
              active
                ? "text-white"
                : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
            )}
          >
            {item.icon ? (
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-active:scale-95",
                  active ? "scale-105" : ""
                )}
              >
                {item.icon}
              </span>
            ) : null}

            <span className="min-w-0 truncate">{item.label}</span>

            {item.badge !== undefined && item.badge !== null ? (
              <span
                className={cn(
                  "flex h-[16px] min-w-[16px] shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold transition-colors duration-300",
                  active
                    ? "bg-white/20 text-white ring-1 ring-inset ring-white/25"
                    : tone === "accent"
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--foreground-faint)]"
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
