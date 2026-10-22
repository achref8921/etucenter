import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground-faint)] shadow-xs">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-[var(--text-label)] text-[var(--foreground-faint)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
