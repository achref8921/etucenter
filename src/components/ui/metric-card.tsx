import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { ProgressRing } from "./progress-ring";

export type MetricTone = "primary" | "success" | "warning" | "error" | "neutral";

const CARD: Record<MetricTone, string> = {
  primary:
    "border-blue-100/80 bg-gradient-to-br from-blue-50 to-white dark:border-blue-500/20 dark:from-blue-500/15 dark:to-transparent",
  success:
    "border-emerald-100/80 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-500/20 dark:from-emerald-500/15 dark:to-transparent",
  warning:
    "border-amber-100/80 bg-gradient-to-br from-amber-50 to-white dark:border-amber-500/20 dark:from-amber-500/15 dark:to-transparent",
  error:
    "border-rose-100/80 bg-gradient-to-br from-rose-50 to-white dark:border-rose-500/20 dark:from-rose-500/15 dark:to-transparent",
  neutral:
    "border-slate-200/70 bg-gradient-to-br from-slate-50 to-white dark:border-white/10 dark:from-white/5 dark:to-transparent",
};

const GLOW: Record<MetricTone, string> = {
  primary: "bg-blue-400/30 dark:bg-blue-500/30",
  success: "bg-emerald-400/30 dark:bg-emerald-500/30",
  warning: "bg-amber-400/30 dark:bg-amber-500/30",
  error: "bg-rose-400/30 dark:bg-rose-500/30",
  neutral: "bg-slate-400/20 dark:bg-white/10",
};

const TILE: Record<MetricTone, string> = {
  primary:
    "bg-white/80 text-blue-600 ring-1 ring-blue-100 dark:bg-white/10 dark:text-blue-300 dark:ring-white/10",
  success:
    "bg-white/80 text-emerald-600 ring-1 ring-emerald-100 dark:bg-white/10 dark:text-emerald-300 dark:ring-white/10",
  warning:
    "bg-white/80 text-amber-600 ring-1 ring-amber-100 dark:bg-white/10 dark:text-amber-300 dark:ring-white/10",
  error:
    "bg-white/80 text-rose-600 ring-1 ring-rose-100 dark:bg-white/10 dark:text-rose-300 dark:ring-white/10",
  neutral:
    "bg-white/80 text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10",
};

const SUB: Record<MetricTone, string> = {
  primary: "text-blue-600 dark:text-blue-300",
  success: "text-emerald-600 dark:text-emerald-300",
  warning: "text-amber-600 dark:text-amber-300",
  error: "text-rose-600 dark:text-rose-300",
  neutral: "text-[var(--foreground-faint)]",
};

const BAR: Record<MetricTone, string> = {
  primary: "bg-blue-500/80 dark:bg-blue-400/80",
  success: "bg-emerald-500/80 dark:bg-emerald-400/80",
  warning: "bg-amber-500/80 dark:bg-amber-400/80",
  error: "bg-rose-500/80 dark:bg-rose-400/80",
  neutral: "bg-slate-400/70 dark:bg-white/40",
};

const RING: Record<MetricTone, string> = {
  primary: "text-blue-600 dark:text-blue-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-rose-600 dark:text-rose-400",
  neutral: "text-slate-500 dark:text-slate-300",
};

function SparkBars({ data, tone }: { data: number[]; tone: MetricTone }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
      {data.map((v, i) => (
        <span
          key={i}
          className={cn("bar-grow min-w-0 flex-1 rounded-[2px] opacity-80", BAR[tone])}
          style={{
            height: `${Math.max(12, Math.round((v / max) * 100))}%`,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  currency = true,
  trend,
  spark,
  ring,
  suffix,
  href,
  className,
}: {
  label: React.ReactNode;
  value: number;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: MetricTone;
  currency?: boolean;
  trend?: "up" | "down";
  spark?: number[];
  ring?: number;
  suffix?: string;
  href?: string;
  className?: string;
}) {
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;
  const card = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[20px] border p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
        CARD[tone],
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl animate-float-soft",
          GLOW[tone]
        )}
      />

      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12.5px] font-medium text-[var(--foreground-faint)]">{label}</p>
          {Icon && (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] backdrop-blur-sm",
                TILE[tone]
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
              <AnimatedNumber value={value} currency={currency} />
              {suffix && (
                <span className="ml-0.5 text-[15px] font-semibold text-[var(--foreground-subtle)]">
                  {suffix}
                </span>
              )}
            </p>
            {sub && (
              <p className={cn("mt-2 flex items-center gap-1 text-[12px] font-medium", SUB[tone])}>
                {trend && <TrendIcon className="h-3.5 w-3.5" />}
                {sub}
              </p>
            )}
          </div>
          {typeof ring === "number" && (
            <ProgressRing value={ring} size={46} stroke={5} className={cn("shrink-0", RING[tone])} />
          )}
        </div>

        {spark && spark.length >= 3 && spark.filter((v) => v > 0).length >= 3 && (
          <div className="mt-4">
            <SparkBars data={spark} tone={tone} />
          </div>
        )}
      </div>
    </div>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={typeof label === "string" ? `${label} — voir le détail` : "Voir le détail"}
      className="block h-full rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
    >
      {card}
    </Link>
  );
}
