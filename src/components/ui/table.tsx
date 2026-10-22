import { cn } from "@/lib/utils";

export function TableWrapper({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-[var(--text-base)]", className)}
      {...props}
    />
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-label)]",
        className
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left font-semibold uppercase tracking-wide text-[var(--foreground-faint)]",
        className
      )}
      {...props}
    />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--surface-muted)]",
        className
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-2.5 align-middle text-[var(--foreground)]", className)}
      {...props}
    />
  );
}
