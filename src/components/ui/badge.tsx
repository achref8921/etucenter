import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral:
    "bg-neutral-100 text-neutral-700 dark:bg-[#1e2128] dark:text-neutral-300",
  primary:
    "bg-[var(--primary)]/10 text-[var(--primary)] dark:text-[var(--accent-foreground)]",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  error:
    "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  info:
    "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[var(--text-caption)] font-semibold",
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}
