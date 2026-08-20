"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

interface RevenueRow {
  name: string;
  revenue: number;
}

interface CenterRow {
  name: string;
  value: number;
}

export function RevenueBarChart({ data }: { data: RevenueRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-neutral-400">Aucune donnée</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(v) => [`${Number(v).toLocaleString("fr-TN")} DT`, "Revenu"]}
        />
        <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CenterPieChart({ data }: { data: CenterRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-neutral-400">Aucune donnée</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
          style={{ fontSize: 11 }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [`${Number(v).toLocaleString("fr-TN")} DT`, "Revenu"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
