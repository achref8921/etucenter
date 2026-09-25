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
  AreaChart,
  Area,
  Legend,
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

export interface UsageDailyRow {
  day: string;
  users: number;
  events: number;
}

export function UsageActivityChart({ data }: { data: UsageDailyRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-neutral-400">Aucune donnée</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="usageUsers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="usageEvents" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="users"
          name="Utilisateurs actifs"
          stroke="#7c3aed"
          fill="url(#usageUsers)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="events"
          name="Événements"
          stroke="#10b981"
          fill="url(#usageEvents)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FeatureUsageChart({ data }: { data: CenterRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-neutral-400">Aucune donnée</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={130} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RoleShareChart({ data }: { data: CenterRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-neutral-400">Aucune donnée</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
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
          formatter={(v) => [Number(v).toLocaleString("fr-TN"), "Événements"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
