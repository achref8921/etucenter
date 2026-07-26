"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Building2, Users, DollarSign, AlertTriangle, TrendingUp, Loader2,
  Plus, X as XIcon, Clock, Ban, CheckCircle,
} from "lucide-react";

interface AnalyticsData {
  totalCenters: number;
  activeCenters: number;
  suspendedCenters: number;
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalGroups: number;
  totalSubAmount: number;
  thisMonthAmount: number;
  subscriptionsThisMonth: number;
  expiringSoon: { id: string; centerName: string; centerId: string; dateFin: string; montant: number }[];
  cancelledSubscriptions: { id: string; centerName: string; centerId: string; dateFin: string; montant: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  centerRevenue: { id: string; name: string; totalPaid: number; subscriptionCount: number }[];
  recentSubscriptions: { id: string; centerName: string; centerId: string; montant: number; dateDebut: string; dateFin: string; statut: string }[];
}

const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return months[parseInt(month) - 1] + " " + year.slice(2);
}

export default function SuperAdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [addForm, setAddForm] = useState({ centerId: "", montant: "", duree: "month", notes: "" });
  const [addLoading, setAddLoading] = useState(false);

  function load() {
    fetch("/api/super-admin/analytics")
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function openAdd() {
    const res = await fetch("/api/super-admin/centers");
    if (res.ok) {
      const d = await res.json();
      setCenters(d.map((c: any) => ({ id: c.id, name: c.name })));
    }
    setShowAddModal(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetch("/api/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centerId: addForm.centerId,
          montant: Number(addForm.montant),
          duree: addForm.duree,
          notes: addForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setAddForm({ centerId: "", montant: "", duree: "month", notes: "" });
        load();
      }
    } finally {
      setAddLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">
        Impossible de charger les analytiques.
      </div>
    );
  }

  const revenueChartData = (data.monthlyRevenue || []).map((m) => ({
    name: formatMonth(m.month),
    revenue: m.revenue,
  }));

  const centerPieData = (data.centerRevenue || [])
    .filter((c) => c.totalPaid > 0)
    .map((c) => ({ name: c.name, value: c.totalPaid }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytiques</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vue globale de la plateforme EduCenter
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          Ajouter un abonnement
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Mcenters actifs</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{data.activeCenters}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                total: {data.totalCenters} | suspendus: {data.suspendedCenters}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Revenus ce mois</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.thisMonthAmount.toLocaleString("fr-TN")} DT
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {data.subscriptionsThisMonth} abonnements actifs
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Utilisateurs totaux</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{data.totalUsers}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {data.totalStudents} élèves | {data.totalTeachers} profs
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Revenu total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.totalSubAmount.toLocaleString("fr-TN")} DT
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {data.totalGroups} groupes
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Revenus mensuels des abonnements
          </h3>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueChartData}>
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
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">Aucune donnée</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Répartition des revenus par centre
          </h3>
          {centerPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={centerPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {centerPieData.map((_, i) => (
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
            <p className="py-12 text-center text-sm text-slate-400">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Expiring Soon + Cancelled */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Expiring Soon */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Clock className="h-4 w-4 text-amber-500" />
              Abonnements expirent bientôt (7 jours)
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {(data.expiringSoon || []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">Aucun abonnement à échoir</p>
            ) : (
              (data.expiringSoon || []).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.centerName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Expire le {new Date(s.dateFin).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                    {s.montant.toLocaleString("fr-TN")} DT
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cancelled */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Ban className="h-4 w-4 text-red-500" />
              Abonnements annulés ({data.cancelledSubscriptions.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {(data.cancelledSubscriptions || []).length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">Aucun abonnement annulé</p>
            ) : (
              (data.cancelledSubscriptions || []).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.centerName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Annulé le {new Date(s.dateFin).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {s.montant.toLocaleString("fr-TN")} DT
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Center Revenue Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Revenus par centre
          </h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Centre</th>
              <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Abonnements</th>
              <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">Total payé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {(data.centerRevenue || []).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{c.subscriptionCount}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                  {c.totalPaid.toLocaleString("fr-TN")} DT
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Subscriptions */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Derniers abonnements
          </h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {(data.recentSubscriptions || []).length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">Aucun abonnement</p>
          ) : (
            (data.recentSubscriptions || []).map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.centerName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(s.dateDebut).toLocaleDateString("fr-FR")} → {new Date(s.dateFin).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {s.montant.toLocaleString("fr-TN")} DT
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    s.statut === "active"
                      ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                  }`}>
                    {s.statut === "active" ? "Actif" : "Annulé"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Subscription Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Ajouter un abonnement
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Centre</label>
                <select
                  value={addForm.centerId}
                  onChange={(e) => setAddForm({ ...addForm, centerId: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">Sélectionner un centre</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Montant (DT)</label>
                <input
                  type="number"
                  value={addForm.montant}
                  onChange={(e) => setAddForm({ ...addForm, montant: e.target.value })}
                  min={0}
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="Ex: 200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Durée</label>
                <select
                  value={addForm.duree}
                  onChange={(e) => setAddForm({ ...addForm, duree: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="month">1 mois</option>
                  <option value="quarter">3 mois</option>
                  <option value="year">1 an</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optionnel)</label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="Notes optionnelles..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !addForm.centerId || !addForm.montant}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {addLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
