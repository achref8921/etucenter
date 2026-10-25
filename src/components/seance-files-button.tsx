"use client";

import type { MouseEventHandler } from "react";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeanceFilesButtonProps {
  count: number;
  onClick: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  compact?: boolean;
  contextLabel?: string;
}

export default function SeanceFilesButton({
  count,
  onClick,
  className,
  compact = false,
  contextLabel,
}: SeanceFilesButtonProps) {
  const hasFiles = count > 0;
  const prefix = contextLabel ? `${contextLabel} : ` : "";

  return (
    <button
      type="button"
      onClick={onClick}
      title={hasFiles ? `Ouvrir les fichiers (${count})` : "Aucun fichier — ouvrir les supports"}
      aria-label={
        hasFiles
          ? `${prefix}ouvrir les fichiers (${count})`
          : `${prefix}aucun fichier, ouvrir les supports`
      }
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
        compact ? "h-7 px-1.5 text-[10px]" : "h-8 px-2 text-[11px]",
        hasFiles
          ? "border-blue-200 bg-blue-50 text-blue-700 shadow-xs hover:bg-blue-100 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
          : "border-transparent text-neutral-400 hover:bg-blue-50 hover:text-blue-600 dark:text-neutral-500 dark:hover:bg-slate-700 dark:hover:text-blue-400",
        className
      )}
    >
      <Paperclip className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      {hasFiles && (
        <>
          <span>Ouvrir</span>
          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] leading-none text-white dark:bg-blue-400 dark:text-slate-950">
            {count}
          </span>
        </>
      )}
    </button>
  );
}
