import { cn } from "@/lib/utils";

const GRAD = {
  primary: "bg-gradient-to-r from-blue-600 to-cyan-400",
  success: "bg-gradient-to-r from-emerald-600 to-teal-400",
  warning: "bg-gradient-to-r from-amber-500 to-yellow-300",
  error: "bg-gradient-to-r from-rose-600 to-pink-400",
  neutral: "bg-gradient-to-r from-slate-500 to-slate-300",
} as const;

const SHADOW = {
  primary: "shadow-[0_0_12px_-2px_rgba(37,99,235,0.6)]",
  success: "shadow-[0_0_12px_-2px_rgba(5,150,105,0.6)]",
  warning: "shadow-[0_0_12px_-2px_rgba(217,119,6,0.6)]",
  error: "shadow-[0_0_12px_-2px_rgba(225,29,72,0.6)]",
  neutral: "",
} as const;

export type ProgressTone = keyof typeof GRAD;

export function ProgressList({
  items,
  className,
}: {
  items: {
    label: string;
    value: number;
    total: number;
    caption?: React.ReactNode;
    tone?: ProgressTone;
  }[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {items.map((it, i) => {
        const pct = it.total > 0 ? Math.round((it.value / it.total) * 100) : 0;
        const tone = it.tone ?? "primary";
        return (
          <div key={i} className="group/row">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="truncate text-[13px] font-medium text-[var(--foreground)]">
                {it.label}
              </p>
              <p className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--foreground-faint)] transition-colors group-hover/row:text-[var(--foreground)]">
                {it.caption ?? `${pct}%`}
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div
                className={cn(
                  "fill-grow h-full rounded-full transition-[filter] duration-300 group-hover/row:brightness-110",
                  GRAD[tone],
                  SHADOW[tone]
                )}
                style={{
                  width: `${Math.max(it.value > 0 ? 4 : 0, Math.min(100, pct))}%`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
