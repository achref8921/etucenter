"use client";

import { useEffect, useState } from "react";

interface MontantInputProps {
  value: number | "";
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
  name?: string;
  autoFocus?: boolean;
  maxLength?: number;
}

function sanitizeAmount(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");
  const sepIndex = s.search(/[.,]/);
  if (sepIndex !== -1) {
    const sep = s[sepIndex];
    const before = s.slice(0, sepIndex);
    const after = s.slice(sepIndex + 1).replace(/[.,]/g, "");
    s = before + sep + after.slice(0, 2);
  }
  return s;
}

function parseAmount(raw: string): number {
  const normalized = raw.replace(",", ".");
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function MontantInput({
  value,
  onChange,
  className,
  placeholder,
  required,
  disabled,
  name,
  autoFocus,
  maxLength,
}: MontantInputProps) {
  const [text, setText] = useState<string>(() =>
    value === "" || value === 0 ? "" : String(value)
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(value === "" || value === 0 ? "" : String(value));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeAmount(e.target.value);
    setText(cleaned);
    onChange(parseAmount(cleaned));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      name={name}
      value={text}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      maxLength={maxLength}
      placeholder={placeholder}
      className={className}
    />
  );
}