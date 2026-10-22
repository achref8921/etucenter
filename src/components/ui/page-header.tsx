import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-[var(--space-section-y)] space-y-1.5", className)}>
      {breadcrumb && (
        <div className="text-[var(--text-caption)] text-[var(--foreground-faint)]">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-[var(--text-display)] font-semibold tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[var(--text-base)] text-[var(--foreground-faint)]">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  actions,
  className,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[var(--text-title)] font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
