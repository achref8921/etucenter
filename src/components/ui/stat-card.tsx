import { cn } from "@/lib/utils";

export type StatTone = "default" | "primary" | "success" | "warning" | "error";

const TONE_STYLES: Record<
  StatTone,
  { tile: string; value: string; ring: string }
> = {
  default: {
    tile: "bg-neutral-100 text-neutral-600 dark:bg-[#232732] dark:text-neutral-300",
    value: "text-[var(--foreground)]",
    ring: "ring-neutral-200/70 dark:ring-[#2a2d35]",
  },
  primary: {
    tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-400",
    ring: "ring-blue-100 dark:ring-blue-500/20",
  },
  success: {
    tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-100 dark:ring-emerald-500/20",
  },
  warning: {
    tile: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-100 dark:ring-amber-500/20",
  },
  error: {
    tile: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    value: "text-red-600 dark:text-red-400",
    ring: "ring-red-100 dark:ring-red-500/20",
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  className?: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "group rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-card)] shadow-sm transition-shadow duration-200 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[var(--text-label)] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
            {label}
          </p>
          <p
            className={cn(
              "text-[1.6rem] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]",
              s.value
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="text-[var(--text-caption)] text-[var(--foreground-faint)]">{hint}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] ring-1",
              s.tile,
              s.ring
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
