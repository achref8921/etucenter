"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  Save,
  Loader2,
  DollarSign,
  Users,
  Percent,
  CreditCard,
  ArrowRight,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MonthSelector } from "@/components/month-selector";

const BeneficesBarChart = dynamic(() => import("@/components/charts/benefices-bar-chart"), { ssr: false });

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
  collecteParProf?: boolean;
  eleve: { id: string; nom: string; prenom: string };
  groupe: { id: string; nom: string };
}

interface PendingDebtDetail {
  id: string;
  date: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: string;
  student: { id: string; nom: string; prenom: string } | null;
}

interface PendingProfDetail {
  prof: { id: string; nom: string; prenom: string };
  balance: number;
  debts: PendingDebtDetail[];
}

interface BeneficesData {
  selectedMonth: string;
  profs: ProfBenefice[];
  totalRecu: number;
  totalBenefice: number;
  totalSalaire: number;
  totalUnpaid: number;
  reverseSettledRevenue: number;
  reversePendingBalance: number;
  reversePendingProfs: PendingProfDetail[];
  monthlyHistory: MonthlyPoint[];
  monthPaiements: PaiementRow[];
}

interface PendingSettlement {
  id: string;
  amount: number;
  createdAt: string;
  description: string;
  teacher: { id: string; nom: string; prenom: string };
  student: { id: string; nom: string; prenom: string } | null;
  debt: { id: string; status: string; balance: number } | null;
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

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminBeneficesPage() {
  const searchParams = useSearchParams();
  const selectedMonth = searchParams.get("month") || getCurrentMonth();
  const [profs, setProfs] = useState<ProfTaux[]>([]);
  const [beneficesData, setBeneficesData] = useState<BeneficesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tauxInputs, setTauxInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingSettlements, setPendingSettlements] = useState<PendingSettlement[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showPendingDetails, setShowPendingDetails] = useState(false);
  const [expandedPendingProf, setExpandedPendingProf] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRate, setPendingRate] = useState<{
    profId: string;
    name: string;
    previous: number | null;
    next: number;
  } | null>(null);

  const fetchPendingSettlements = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reverse/settlements");
      if (!res.ok) throw new Error("Erreur lors du chargement des règlements");
      const data = await res.json();
      setPendingSettlements(data.settlements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }, []);

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
      await Promise.all([fetchTaux(), fetchBenefices(selectedMonth), fetchPendingSettlements()]);
      setLoading(false);
    };
    load();
  }, [fetchTaux, fetchBenefices, fetchPendingSettlements, selectedMonth]);

  // Rafraîchit les versements en attente quand l'admin revient sur l'onglet,
  // afin qu'une déclaration de professeur apparaisse sans recharger la page.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void fetchPendingSettlements();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchPendingSettlements]);

  const confirmSettlement = async (id: string) => {
    if (
      !window.confirm(
        "Confirmer la réception de ce versement ? Le montant sera comptabilisé dans les bénéfices et la dette réduite."
      )
    ) {
      return;
    }
    setConfirmingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reverse/settlements/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data.error || "").replace(/_/g, " ") || "Erreur lors de la confirmation");
      }
      await Promise.all([fetchPendingSettlements(), fetchBenefices(selectedMonth)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleSaveTaux = (profId: string) => {
    const value = tauxInputs[profId];
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 100) {
      setError("Le taux doit être entre 0 et 100");
      return;
    }
    const prof = profs.find((p) => p.id === profId);
    const previous = prof?.tauxPourcentage ?? null;
    if (previous !== null && previous !== num) {
      setPendingRate({
        profId,
        name: `${prof?.prenom ?? ""} ${prof?.nom ?? ""}`.trim(),
        previous,
        next: num,
      });
      return;
    }
    void performSaveTaux(profId, num, false);
  };

  const performSaveTaux = async (profId: string, num: number, applyToExisting: boolean) => {
    try {
      setSavingId(profId);
      setError(null);
      setNotice(null);
      const res = await fetch("/api/admin/taux-benefices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profId, tauxPourcentage: num, applyToExisting }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la sauvegarde");
      }
      const body = await res.json();
      const applied = body?.applied as { paiements: number; earnings: number } | undefined;
      if (applyToExisting && applied) {
        setNotice(
          `Taux appliqué à tout l'historique : ${applied.paiements} paiement(s) et ${applied.earnings} gain(s) recalculés.`
        );
      }
      await Promise.all([fetchTaux(), fetchBenefices(selectedMonth)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingId(null);
      setPendingRate(null);
    }
  };

  const chartData = beneficesData?.monthlyHistory.map((h) => ({
    name: formatMonthLabel(h.month),
    Revenus: h.totalRecu,
    Bénéfices: h.totalBenefice,
    Salaires: h.totalSalaire,
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Bénéfices du Centre
        </h1>
        <MonthSelector month={selectedMonth} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
          {notice}
        </div>
      )}

      {beneficesData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Revenu net
                </p>
                <p className="mt-2 text-xl font-bold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(beneficesData.totalRecu)}
                </p>
              </div>
              <Banknote className="h-5 w-5 text-[var(--foreground-faint)]" />
            </div>
          </div>
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Bénéfice Centre
                </p>
                <p className="mt-2 text-xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
                  {formatCurrency(beneficesData.totalBenefice)}
                </p>
                {beneficesData.reverseSettledRevenue > 0 && (
                  <div className="mt-1.5 flex flex-col gap-0.5 text-[12px] text-[var(--foreground-faint)]">
                    <span>
                      dont encaissements réglés :{" "}
                      <b className="tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(beneficesData.reverseSettledRevenue)}
                      </b>
                    </span>
                    <span>
                      dont revenus groupes :{" "}
                      <b className="tabular-nums text-blue-700 dark:text-blue-400">
                        {formatCurrency(Math.max(0, beneficesData.totalBenefice - beneficesData.reverseSettledRevenue))}
                      </b>
                    </span>
                  </div>
                )}
              </div>
              <TrendingUp className="h-5 w-5 text-[var(--foreground-faint)]" />
            </div>
          </div>
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Salaires Prof
                </p>
                <p className="mt-2 text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
                  {formatCurrency(beneficesData.totalSalaire)}
                </p>
              </div>
              <Users className="h-5 w-5 text-[var(--foreground-faint)]" />
            </div>
          </div>
        </div>
      )}

      {beneficesData && beneficesData.totalUnpaid > 0 && (
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Impayés total
              </p>
              <p className="mt-2 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(beneficesData.totalUnpaid)}
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-red-400 dark:text-red-500" />
          </div>
        </div>
      )}

      {beneficesData && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => setShowPendingDetails((v) => !v)}
            className="flex w-full items-center justify-between p-5 text-left"
            aria-expanded={showPendingDetails}
          >
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Parts centre en cours (non réglées)
              </p>
              <p className="mt-2 text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(beneficesData.reversePendingBalance)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-400 dark:text-amber-500" />
              <ChevronDown
                className={`h-4 w-4 text-neutral-400 transition-transform dark:text-neutral-500 ${
                  showPendingDetails ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {showPendingDetails && (
            <div className="border-t border-[var(--border)]">
              {beneficesData.reversePendingProfs.length === 0 ? (
                <p className="px-5 py-6 text-center text-[13px] text-[var(--foreground-faint)]">
                  Aucune part centre en cours.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                          Professeur
                        </th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                          Dettes
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                          Montant en cours
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {beneficesData.reversePendingProfs.map((p) => {
                        const open = expandedPendingProf === p.prof.id;
                        return (
                          <Fragment key={p.prof.id}>
                            <tr
                              onClick={() => setExpandedPendingProf(open ? null : p.prof.id)}
                              className="cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                            >
                              <td className="px-5 py-2.5 font-medium text-[var(--foreground)]">
                                <div className="flex items-center gap-2">
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${
                                      open ? "rotate-180" : "-rotate-90"
                                    }`}
                                  />
                                  {p.prof.prenom} {p.prof.nom}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                                {p.debts.length}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                                {formatCurrency(p.balance)}
                              </td>
                            </tr>
                            {open && (
                              <tr key={`${p.prof.id}-detail`}>
                                <td colSpan={3} className="bg-neutral-50 px-5 py-3 dark:bg-[#1e2128]">
                                  <table className="w-full text-left text-[12px]">
                                    <thead>
                                      <tr className="border-b border-[var(--border)]">
                                        <th className="py-1.5 pr-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                                          Élève
                                        </th>
                                        <th className="py-1.5 pr-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                                          Date
                                        </th>
                                        <th className="py-1.5 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                                          Dû
                                        </th>
                                        <th className="py-1.5 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                                          Réglé
                                        </th>
                                        <th className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                                          Reste
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-[#2a2d35]">
                                      {p.debts.map((d) => (
                                        <tr key={d.id}>
                                          <td className="py-1.5 pr-4 text-[var(--foreground-subtle)]">
                                            {d.student ? `${d.student.prenom} ${d.student.nom}` : "—"}
                                          </td>
                                          <td className="py-1.5 pr-4 text-[var(--foreground-faint)]">
                                            {new Date(d.date).toLocaleDateString("fr-FR")}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right tabular-nums text-[var(--foreground-subtle)]">
                                            {formatCurrency(d.amountDue)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(d.amountPaid)}
                                          </td>
                                          <td className="py-1.5 text-right font-medium tabular-nums text-amber-600 dark:text-amber-400">
                                            {formatCurrency(d.balance)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={`rounded-lg border ${
          pendingSettlements.length > 0
            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
            : "border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]"
        }`}
      >
        <div
          className={`flex items-center gap-2 border-b px-5 py-3 ${
            pendingSettlements.length > 0
              ? "border-amber-200 dark:border-amber-800"
              : "border-neutral-200 dark:border-[#2a2d35]"
          }`}
        >
          <CheckCircle2 className={`h-4 w-4 ${pendingSettlements.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-neutral-400 dark:text-neutral-500"}`} />
          <h2 className={`text-[13px] font-semibold ${pendingSettlements.length > 0 ? "text-amber-900 dark:text-amber-100" : "text-neutral-900 dark:text-neutral-100"}`}>
            Règlements en attente de confirmation
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              pendingSettlements.length > 0
                ? "bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-neutral-100 text-neutral-500 dark:bg-[#1e2128] dark:text-neutral-400"
            }`}
          >
            {pendingSettlements.length}
          </span>
        </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-amber-200 dark:border-amber-800">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Professeur</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Détail</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Date</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Montant</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 dark:divide-amber-900/40">
                {pendingSettlements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-[13px] text-[var(--foreground-faint)]">
                      Aucun versement en attente de confirmation. Les versements déclarés par les professeurs apparaîtront ici.
                    </td>
                  </tr>
                )}
                {pendingSettlements.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                      {s.teacher.prenom} {s.teacher.nom}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                      {s.student ? `${s.student.prenom} ${s.student.nom}` : "Versement global"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--foreground-faint)]">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatCurrency(Number(s.amount))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => confirmSettlement(s.id)}
                        disabled={confirmingId === s.id}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {confirmingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Confirmer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {beneficesData && beneficesData.profs.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
              Bénéfices par professeur
            </h2>
            <Link
              href="/admin/finances-professeurs"
              prefetch={false}
              className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Comptes profs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Prof</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Taux</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Reçu</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Centre</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Salaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {beneficesData.profs.map((e) => (
                  <tr key={e.prof.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                    <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                      {e.prof.prenom} {e.prof.nom}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-600/10 dark:text-blue-400">
                        {e.tauxPourcentage}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                      {formatCurrency(e.totalRecu)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-medium text-blue-700 dark:text-blue-400">
                      {formatCurrency(e.beneficeCentre)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-medium text-purple-600 dark:text-purple-400">
                      {formatCurrency(e.salaireProf)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-50 font-semibold dark:bg-[#1e2128]">
                  <td className="px-4 py-2.5 text-[var(--foreground)]">Total</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                    {formatCurrency(beneficesData.totalRecu)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-blue-700 dark:text-blue-400">
                    {formatCurrency(beneficesData.totalBenefice)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-purple-600 dark:text-purple-400">
                    {formatCurrency(beneficesData.totalSalaire)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {beneficesData && beneficesData.monthPaiements && beneficesData.monthPaiements.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--foreground)]">
              <CreditCard className="h-4 w-4 text-[var(--foreground-faint)]" />
              Paiements du mois — {formatMonthLabel(beneficesData.selectedMonth)}
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-[#2a2d35] dark:text-neutral-400">
                {beneficesData.monthPaiements.length}
              </span>
            </h2>
            <Link
              href={`/admin/finances?month=${beneficesData.selectedMonth}`}
              prefetch={false}
              className="flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400"
            >
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                    Élève
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                    Groupe
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {beneficesData.monthPaiements.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/eleves/${p.eleve.id}`}
                        prefetch={false}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {p.eleve.prenom} {p.eleve.nom}
                      </Link>
                      {p.collecteParProf && (
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          Encaissé par le prof
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                      {p.groupe.nom}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--foreground-faint)]">
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

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
            Taux de profit par prof
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Prof
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Groupes
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Élèves
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Taux
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {profs.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                    {e.prenom} {e.nom}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                    {e.nombreGroupes}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                    {e.nombreEleves}
                  </td>
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
                        className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center text-[13px] text-neutral-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600/20 dark:text-neutral-100 dark:focus:border-blue-400"
                      />
                      <Percent className="h-4 w-4 text-[var(--foreground-faint)]" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleSaveTaux(e.id)}
                      disabled={savingId === e.id}
                      className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-[#1e2128]"
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
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--foreground-faint)]">
                    Aucun prof trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
          Évolution des bénéfices (12 mois)
        </h2>
        <BeneficesBarChart data={chartData} formatCurrency={formatCurrency} />
      </div>

      {pendingRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
                  Changer le taux de {pendingRate.name} ?
                </h3>
                <p className="mt-1 text-[13px] text-[var(--foreground-faint)]">
                  Taux actuel : <strong>{pendingRate.previous ?? 0}%</strong> → nouveau :{" "}
                  <strong>{pendingRate.next}%</strong>
                </p>
              </div>
            </div>
            <p className="mb-4 text-[13px] text-neutral-600 dark:text-neutral-300">
              Comment appliquer ce nouveau taux aux calculs financiers de ce prof ?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => performSaveTaux(pendingRate.profId, pendingRate.next, false)}
                disabled={savingId === pendingRate.profId}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-left hover:bg-neutral-50 disabled:opacity-50 dark:hover:bg-[#1e2128]"
              >
                <span className="block text-[13px] font-medium text-[var(--foreground)]">
                  Nouvelles opérations uniquement
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--foreground-faint)]">
                  Les anciens calculs et paiements restent inchangés
                </span>
              </button>
              <button
                onClick={() => performSaveTaux(pendingRate.profId, pendingRate.next, true)}
                disabled={savingId === pendingRate.profId}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-left hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
              >
                <span className="block text-[13px] font-medium text-amber-800 dark:text-amber-300">
                  Anciennes + nouvelles opérations
                </span>
                <span className="mt-0.5 block text-[12px] text-amber-700/80 dark:text-amber-400/80">
                  Recalcule tout l&apos;historique de ce prof avec ce taux
                </span>
              </button>
              <button
                onClick={() => setPendingRate(null)}
                disabled={savingId === pendingRate.profId}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-[#1e2128]"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
