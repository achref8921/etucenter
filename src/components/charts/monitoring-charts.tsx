"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  t: string;
  [key: string]: string | number;
}

export function MemChart({ data }: { data: DataPoint[] }) {
  if (data.length <= 1) {
    return (
      <p className="py-10 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
        Pas encore assez de données
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
        <Tooltip />
        <Area type="monotone" dataKey="RSS" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
        <Area type="monotone" dataKey="Heap" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LatencyChart({ data }: { data: DataPoint[] }) {
  if (data.length <= 1) {
    return (
      <p className="py-10 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
        Pas encore assez de données
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
        <Tooltip />
        <Line type="monotone" dataKey="ms" stroke="#2563eb" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
