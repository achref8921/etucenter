import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const color = PALETTE[hash % PALETTE.length];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        color,
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
