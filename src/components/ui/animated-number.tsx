"use client";

import { useEffect, useRef, useState } from "react";

const currencyFmt = new Intl.NumberFormat("fr-TN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const intFmt = new Intl.NumberFormat("fr-FR");

export function AnimatedNumber({
  value,
  currency = true,
  duration = 850,
  className,
}: {
  value: number;
  currency?: boolean;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = prev.current;
    const to = Number.isFinite(value) ? value : 0;
    if (reduce || from === to) {
      prev.current = to;
      setDisplay(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text = currency
    ? currencyFmt.format(display) + " DT"
    : intFmt.format(Math.round(display));

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
