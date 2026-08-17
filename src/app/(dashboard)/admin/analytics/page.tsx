"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  Users, UserPlus, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Loader2, BookOpen, Calendar, Minus, UserX,
} from "lucide-react";

interface AnalyticsData {
  totalStudents: number;
  studentsThisMonth: number;
  studentsChange: number;
  totalTeachers: number;
  totalSeances: number;
  seancesThisMonth: number;
  totalPaid: number;
  paidThisMonth: number;
  paidLastMonth: number;
  revenueChange: number;
  unpaidAmount: number;
  absenceRate: number;
  topAbsenceTeacher: { id: string; nom: string; prenom: string; absences: number }[];
  topProfitSubject: { id: string; nom: string; totalRevenue: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  monthlyStudents: { month: string; count: number }[];
  monthlyPresences: { month: string; present: number; absent: number }[];
}

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return months[parseInt(month) - 1] + " " + year.slice(2);
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Impossible de charger les analytiques.
      </div>
    );
  }

  const revenueChartData = (data.monthlyRevenue || []).map((m) => ({
    name: formatMonth(m.month),
    revenue: m.revenue,
  }));

  const studentsChartData = (data.monthlyStudents || []).map((m) => ({
    name: formatMonth(m.month),
    eleves: m.count,
  }));

  const presenceChartData = (data.monthlyPresences || []).map((m) => ({
    name: formatMonth(m.month),
    present: m.present,
    absent: m.absent,
  }));

  const subjectPieData = (data.topProfitSubject || []).map((s) => ({
    name: s.nom,
    value: s.totalRevenue,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Analytiques</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Vue détaillée des performances de votre centre
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          iconBg="bg-blue-500"
          label="Élèves ce mois"
          value={data.studentsThisMonth}
          suffix={` total: ${data.totalStudents}`}
          change={data.studentsChange}
        />
        <KpiCard
          icon={DollarSign}
          iconBg="bg-green-500"
          label="Revenus ce mois"
          value={`${data.paidThisMonth.toLocaleString("fr-TN")} DT`}
          suffix={` total: ${data.totalPaid.toLocaleString("fr-TN")} DT`}
          change={data.revenueChange}
        />
        <KpiCard
          icon={AlertTriangle}
          iconBg="bg-neutral-500"
          label="Taux d'absentéisme"
          value={`${data.absenceRate}%`}
          suffix={`total impayé: ${data.unpaidAmount.toLocaleString("fr-TN")} DT`}
        />
        <KpiCard
          icon={Calendar}
          iconBg="bg-amber-500"
          label="Séances ce mois"
          value={data.seancesThisMonth}
          suffix={`total: ${data.totalSeances}`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5  dark:border-[#2a2d35] dark:bg-[#181b22]">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Revenus mensuels
          </h3>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v) => [`${Number(v).toLocaleString("fr-TN")} DT`, "Revenu"]}
                />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">Aucune donnée</p>
          )}
        </div>

        {/* Presence Chart */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5  dark:border-[#2a2d35] dark:bg-[#181b22]">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Présences / Absences
          </h3>
          {presenceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={presenceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="present" name="Présent" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Students Enrollment */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5  dark:border-[#2a2d35] dark:bg-[#181b22]">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Nouveaux élèves par mois
          </h3>
          {studentsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={studentsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="eleves" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">Aucune donnée</p>
          )}
        </div>

        {/* Subject Revenue Pie */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5  dark:border-[#2a2d35] dark:bg-[#181b22]">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Revenus par matière
          </h3>
          {subjectPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={subjectPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {subjectPieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${Number(v).toLocaleString("fr-TN")} DT`, "Revenu"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Absent Teachers */}
        <div className="rounded-xl border border-neutral-200 bg-white  dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="border-b border-neutral-200 px-5 py-3 dark:border-[#2a2d35]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <UserX className="h-4 w-4 text-red-500" />
              Profs avec le plus d&apos;absences (élèves)
            </h3>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {(data.topAbsenceTeacher || []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-400">Aucune donnée</p>
            ) : (
              (data.topAbsenceTeacher || []).map((t, i) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 dark:bg-[#1e2128] dark:text-neutral-400">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {t.prenom} {t.nom}
                    </span>
                  </div>
                  <span className="rounded-full bg-neutral-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {t.absences} abs.
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Profit Subjects */}
        <div className="rounded-xl border border-neutral-200 bg-white  dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="border-b border-neutral-200 px-5 py-3 dark:border-[#2a2d35]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <BookOpen className="h-4 w-4 text-green-500" />
              Matières les plus rentables
            </h3>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {(data.topProfitSubject || []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-400">Aucune donnée</p>
            ) : (
              (data.topProfitSubject || []).map((s, i) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 dark:bg-[#1e2128] dark:text-neutral-400">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {s.nom}
                    </span>
                  </div>
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:bg-green-900/20 dark:text-green-400">
                    {s.totalRevenue.toLocaleString("fr-TN")} DT
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconBg,
  label,
  value,
  suffix,
  change,
}: {
  icon: any;
  iconBg: string;
  label: string;
  value: string | number;
  suffix?: string;
  change?: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5  dark:border-[#2a2d35] dark:bg-[#181b22]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{value}</p>
          {suffix && (
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{suffix}</p>
          )}
          {change !== undefined && (
            <div className="mt-1 flex items-center gap-1">
              {change > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : change < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-neutral-400" />
              )}
              <span className={`text-xs font-medium ${change > 0 ? "text-green-600 dark:text-green-400" : change < 0 ? "text-red-600 dark:text-red-400" : "text-neutral-400"}`}>
                {change > 0 ? "+" : ""}{change}%
              </span>
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}
