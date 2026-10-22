"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs hover:brightness-[0.94] active:brightness-[0.88]",
  secondary:
    "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-neutral-200 dark:hover:bg-[#232732]",
  outline:
    "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  ghost:
    "text-[var(--foreground-subtle)] hover:bg-neutral-100 hover:text-[var(--foreground)] dark:hover:bg-[#1e2128]",
  destructive:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)] shadow-xs hover:brightness-[0.94] active:brightness-[0.88]",
  success:
    "bg-[var(--success)] text-white shadow-xs hover:brightness-[0.94] active:brightness-[0.88]",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-[var(--radius-md)] px-3 text-[var(--text-label)]",
  md: "h-[var(--control-md)] gap-2 rounded-[var(--radius-lg)] px-4 text-[var(--text-base)]",
  lg: "h-[var(--control-lg)] gap-2 rounded-[var(--radius-lg)] px-5 text-[var(--text-base)]",
  icon: "h-[var(--control-md)] w-[var(--control-md)] rounded-[var(--radius-lg)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-[filter,background-color,color] duration-150 motion-reduce:transition-none",
        "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
