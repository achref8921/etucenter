"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function BarChart({
  data,
  format = "number",
  height = 190,
  className,
}: {
  data: { label: string; value: number }[];
  format?: "currency" | "number";
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [mounted, setMounted] = useState(false);

  const fmt = (v: number) =>
    format === "currency"
      ? new Intl.NumberFormat("fr-TN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(v) + " DT"
      : new Intl.NumberFormat("fr-FR").format(v);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative" style={{ height }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {[0, 25, 50, 75, 100].map((p) => (
            <div
              key={p}
              className="absolute inset-x-0 border-t border-dashed border-[var(--border)] opacity-60"
              style={{ bottom: `${p}%` }}
            />
          ))}
        </div>

        <div
          className="absolute inset-0 flex items-end gap-2 sm:gap-3"
          role="img"
          aria-label="Graphique en barres des revenus par professeur"
        >
          {data.map((d, i) => {
            const pct = Math.round((d.value / max) * 100);
            return (
              <div
                key={i}
                className="group/bar relative flex h-full flex-1 items-end justify-center"
              >
                <div className="pointer-events-none absolute -top-1 z-20 -translate-y-full whitespace-nowrap rounded-lg bg-[var(--foreground)] px-2 py-1 text-[11px] font-semibold text-[var(--surface)] opacity-0 shadow-lg transition-opacity duration-150 group-hover/bar:opacity-100">
                  {fmt(d.value)}
                </div>
                <div
                  className="relative w-full max-w-[54px] rounded-t-[8px] bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-300 shadow-[0_0_20px_-3px_rgba(37,99,235,0.6)] transition-[height,filter] duration-700 ease-out group-hover/bar:brightness-110"
                  style={{
                    height: mounted ? `${Math.max(d.value > 0 ? 6 : 2, pct)}%` : "0%",
                    transitionDelay: `${i * 70}ms`,
                  }}
                >
                  <span className="absolute inset-x-1 top-1 h-1/3 rounded-t-[6px] bg-white/25" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d, i) => (
          <p
            key={i}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-[var(--foreground-faint)]"
            title={d.label}
          >
            {d.label}
          </p>
        ))}
      </div>
    </div>
  );
}
