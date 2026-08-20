"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartRow {
  name: string;
  Revenus: number;
  Bénéfices: number;
  Salaires: number;
}

export default function BeneficesBarChart({
  data,
  formatCurrency,
}: {
  data: ChartRow[];
  formatCurrency: (n: number) => string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
        Aucune donnée pour le graphique
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
        />
        <Legend />
        <Bar dataKey="Revenus" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Bénéfices" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Salaires" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
