"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Save, Loader2, DollarSign, Users, Percent, CreditCard, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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

interface ProfTaux {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  tauxPourcentage: number | null;
  tauxBeneficeId: string | null;
  nombreGroupes: number;
  nombreEleves: number;
  groupes: { id: string; nom: string; nombreEleves: number }[];
}

interface ProfBenefice {
  prof: { id: string; nom: string; prenom: string };
  tauxPourcentage: number;
  totalRecu: number;
  beneficeCentre: number;
  salaireProf: number;
  nombreEleves: number;
}

interface MonthlyPoint {
  month: string;
  totalBenefice: number;
  totalRecu: number;
  totalSalaire: number;
}

interface PaiementRow {
  id: string;
  montant: number;
  datePaiement: string;
  eleve: { id: string; nom: string; prenom: string };
  groupe: { id: string; nom: string };
}

interface BeneficesData {
  selectedMonth: string;
  profs: ProfBenefice[];
  totalRecu: number;
  totalBenefice: number;
  totalSalaire: number;
  monthlyHistory: MonthlyPoint[];
  monthPaiements: PaiementRow[];
}

const monthLabels: Record<string, string> = {
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
};

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return `${monthLabels[mo] || mo} ${y}`;
}

function getLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export default function AdminBeneficesPage() {
  const [profs, setProfs] = useState<ProfTaux[]>([]);
  const [beneficesData, setBeneficesData] = useState<BeneficesData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tauxInputs, setTauxInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchTaux = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/taux-benefices");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setProfs(data);
      const inputs: Record<string, string> = {};
      data.forEach((e: ProfTaux) => {
        inputs[e.id] = e.tauxPourcentage !== null ? String(e.tauxPourcentage) : "";
      });
      setTauxInputs(inputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }, []);

  const fetchBenefices = useCallback(async (month: string) => {
    try {
      const res = await fetch(`/api/admin/benefices?month=${month}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setBeneficesData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTaux(), fetchBenefices(selectedMonth)]);
      setLoading(false);
    };
    load();
  }, [fetchTaux, fetchBenefices, selectedMonth]);

  const handleSaveTaux = async (profId: string) => {
    const value = tauxInputs[profId];
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) {
      setError("Le taux doit être entre 0 et 100");
      return;
    }
    try {
      setSavingId(profId);
      setError(null);
      const res = await fetch("/api/admin/taux-benefices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profId, tauxPourcentage: num }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la sauvegarde");
      }
      await Promise.all([fetchTaux(), fetchBenefices(selectedMonth)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingId(null);
    }
  };

  const chartData = beneficesData?.monthlyHistory.map((h) => ({
    name: formatMonthLabel(h.month),
    "Revenus": h.totalRecu,
    "Bénéfices": h.totalBenefice,
    "Salaires": h.totalSalaire,
  })) || [];

  const allMonths = getLast12Months();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Bénéfices du Centre</h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400">Tafsil taux de profit par prof + analyse mensuelle</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Mois:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            {allMonths.map((m) => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {beneficesData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Total Revenus</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(beneficesData.totalRecu)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Bénéfices</p>
                <p className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">{formatCurrency(beneficesData.totalBenefice)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Salaires Prof</p>
                <p className="mt-1 text-2xl font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(beneficesData.totalSalaire)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {beneficesData && beneficesData.monthPaiements && beneficesData.monthPaiements.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#2a2d35] px-5 py-3">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
              <CreditCard className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
              Paiements du mois — {formatMonthLabel(beneficesData.selectedMonth)}
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-[#2a2d35] dark:text-neutral-400">
                {beneficesData.monthPaiements.length}
              </span>
            </h2>
            <a
              href={`/admin/finances?month=${beneficesData.selectedMonth}`}
              className="flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800"
            >
              Tout voir <ArrowRight className="h-3 w-3" />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-[#2a2d35]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Élève</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
                {beneficesData.monthPaiements.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                    <td className="px-4 py-2.5">
                      <a href={`/admin/eleves/${p.eleve.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        {p.eleve.prenom} {p.eleve.nom}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{p.groupe.nom}</td>
                    <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400">
                      {new Date(p.datePaiement).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-green-600 dark:text-green-400">
                      {formatCurrency(Number(p.montant))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Taux de Profit par Prof</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Prof</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Groupes</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Eleves</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Taux (%)</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {profs.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-sm font-semibold text-blue-700 dark:text-blue-400">
                        {e.prenom[0]}{e.nom[0]}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">{e.prenom} {e.nom}</p>
                        <p className="text-[12px] text-neutral-400 dark:text-neutral-500">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{e.nombreGroupes}</td>
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{e.nombreEleves}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={tauxInputs[e.id] || ""}
                        onChange={(ev) => setTauxInputs((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                        placeholder="0"
                        className="w-20 rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-2 py-1.5 text-[13px] text-center focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <Percent className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleSaveTaux(e.id)}
                      disabled={savingId === e.id}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingId === e.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Sauvegarder
                    </button>
                  </td>
                </tr>
              ))}
              {profs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                    Aucun prof trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Évolution des bénéfices (12 mois)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
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
              <Bar dataKey="Revenus" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Bénéfices" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Salaires" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">Aucune donnée pour le graphique</p>
        )}
      </div>

      {beneficesData && beneficesData.profs.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Détail des bénéfices — {formatMonthLabel(beneficesData.selectedMonth)}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
                <tr>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Prof</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Taux</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Nb Eleves</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Total Reçu</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Bénéfices</th>
                  <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Salaire Prof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
                {beneficesData.profs.map((e) => (
                  <tr key={e.prof.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                    <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">{e.prof.prenom} {e.prof.nom}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-400">
                        {e.tauxPourcentage}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{e.nombreEleves}</td>
                    <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(e.totalRecu)}</td>
                    <td className="px-4 py-2.5 font-medium text-green-600 dark:text-green-400">{formatCurrency(e.beneficeCentre)}</td>
                    <td className="px-4 py-2.5 font-medium text-purple-600 dark:text-purple-400">{formatCurrency(e.salaireProf)}</td>
                  </tr>
                ))}
                <tr className="bg-neutral-50 dark:bg-[#1e2128] font-semibold">
                  <td className="px-4 py-2.5 text-neutral-900 dark:text-neutral-100">Total</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-neutral-900 dark:text-neutral-100">{formatCurrency(beneficesData.totalRecu)}</td>
                  <td className="px-4 py-2.5 text-green-600 dark:text-green-400">{formatCurrency(beneficesData.totalBenefice)}</td>
                  <td className="px-4 py-2.5 text-purple-600 dark:text-purple-400">{formatCurrency(beneficesData.totalSalaire)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
