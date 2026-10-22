"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

const FIELD_BASE =
  "w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-base)] text-[var(--foreground)] " +
  "placeholder:text-[var(--foreground-faint)] transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:border-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60";

const FIELD_ERROR = "border-[var(--destructive)] focus-visible:border-[var(--destructive)]";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type = "text", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, "h-[var(--control-md)]", invalid && FIELD_ERROR, className)}
      {...props}
    />
  );
});

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, rows = 3, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(FIELD_BASE, "py-2 leading-relaxed", invalid && FIELD_ERROR, className)}
        {...props}
      />
    );
  }
);

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, "h-[var(--control-md)] pr-8", invalid && FIELD_ERROR, className)}
      {...props}
    >
      {children}
    </select>
  );
});

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-[var(--text-label)] font-medium text-[var(--foreground-subtle)]"
        >
          {label}
          {required && <span className="ml-0.5 text-[var(--destructive)]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[var(--text-caption)] text-[var(--destructive)]">{error}</p>
      ) : hint ? (
        <p className="text-[var(--text-caption)] text-[var(--foreground-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function useFieldId(provided?: string) {
  const generated = useId();
  return provided ?? generated;
}
