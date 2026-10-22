"use client";

import { useEffect, useState } from "react";

export function ProgressRing({
  value,
  size = 48,
  stroke = 5,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const target = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const [p, setP] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setP(target);
      return;
    }
    const id = setTimeout(() => setP(target), 80);
    return () => clearTimeout(id);
  }, [target]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  const half = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <circle
        cx={half}
        cy={half}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="opacity-15"
      />
      <circle
        cx={half}
        cy={half}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${half} ${half})`}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.2,0.7,0.2,1)" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="currentColor"
        style={{ fontSize: Math.round(size * 0.27), fontWeight: 700 }}
      >
        {Math.round(p)}%
      </text>
    </svg>
  );
}
