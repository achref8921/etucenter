"use client";

import { useEffect, useState } from "react";
import { Wallet, FileText, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { SkeletonPage } from "@/components/ui/skeleton";

interface ProfitData {
  total: number;
  studentShare: number;
  reverseNet: number;
  adjustments: number;
}

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount: number;
  signedAmount: number;
  description: string;
  paymentMethod: string | null;
  date: string;
  receiptNumber: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  EARNING: "Gain",
  PAYMENT: "Paiement",
  ADJUSTMENT: "Ajustement",
  REVERSAL: "Annulation",
};

const METHODE_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

const isStudentGain = (tx: TransactionRow) =>
  tx.type === "EARNING" && (tx.reference?.startsWith("paiement:") ?? false);

export default function ProfComptePage() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [claimable, setClaimable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayBalance, setDisplayBalance] = useState(0);
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [profit, setProfit] = useState<ProfitData>({
    total: 0,
    studentShare: 0,
    reverseNet: 0,
    adjustments: 0,
  });

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = () => {
    const [y, m] = month.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  };

  useEffect(() => {
    if (claimable === 0) {
      setDisplayBalance(0);
      return;
    }
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayBalance(claimable * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [claimable]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/prof/teacher-finance?month=${month}`);
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setTransactions(data.transactions);
        setClaimable(data.claimable ?? data.balance ?? 0);
        setProfit(
          data.profit ?? { total: 0, studentShare: 0, reverseNet: 0, adjustments: 0 }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month]);

  if (loading) {
    return <SkeletonPage />;
  }

  const openReceipt = (tx: TransactionRow) => {
    window.open(`/api/prof/teacher-finance/${tx.id}/receipt`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Mon Compte</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        className={`animate-fade-in-up rounded-xl border p-6 ${
          claimable >= 0
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-[13px] font-medium ${
                claimable >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {claimable >= 0 ? "À encaisser" : "À encaisser (négatif)"}
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                claimable >= 0
                  ? "text-emerald-900 dark:text-emerald-100"
                  : "text-red-900 dark:text-red-100"
              }`}
            >
              {claimable !== 0 && (claimable > 0 ? "+" : "−")}
              {formatCurrency(Math.abs(displayBalance))}
            </p>
            <p className="mt-1 text-[12px] text-[var(--foreground-faint)]">
              {claimable > 0
                ? "Le centre vous doit ce montant."
                : claimable < 0
                  ? "Ce montant est à régler au centre."
                  : "Votre à encaisser est nul."}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface)]">
            <Wallet className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 p-5 dark:border-emerald-800/40 dark:from-emerald-500/5 dark:via-[#181b22] dark:to-emerald-500/5">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-100/50 dark:bg-emerald-500/5" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground-faint)] hover:bg-[var(--surface)] dark:hover:bg-[#1e2128]"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => shiftMonth(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground-faint)] hover:bg-[var(--surface)] dark:hover:bg-[#1e2128]"
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Profit net · {monthLabel()}
              </p>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(profit.total)}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--foreground-faint)]">
              <span>
                Gains élèves :{" "}
                <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(profit.studentShare)}</b>
              </span>
              <span>
                Encaissements directs :{" "}
                <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(profit.reverseNet)}</b>
              </span>
              <span>
                Ajustements :{" "}
                <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(profit.adjustments)}</b>
              </span>
            </div>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--surface)]">
            <TrendingUp className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
            Historique des transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Date</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Description</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Méthode</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Montant</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] dark:divide-slate-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--foreground-faint)]">
                    Aucune transaction
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] ${
                      tx.status === "reversed" ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                          tx.type === "REVERSAL"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : tx.type === "PAYMENT"
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                              : tx.type === "EARNING"
                                ? isStudentGain(tx)
                                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400"
                        }`}
                      >
                        {isStudentGain(tx) ? "Gain élève" : TYPE_LABEL[tx.type]}
                      </span>
                      {tx.status === "reversed" && (
                        <span className="ml-1 inline-block rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-[12px] text-neutral-600 dark:text-neutral-300">
                          Annulé
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-2.5">
                      <p className="truncate text-[var(--foreground-subtle)]">{tx.description}</p>
                      {tx.receiptNumber && (
                        <p className="text-[12px] text-[var(--foreground-faint)]">{tx.receiptNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                      {tx.paymentMethod ? METHODE_LABEL[tx.paymentMethod] || tx.paymentMethod : "—"}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-semibold ${
                        Number(tx.signedAmount) >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {Number(tx.signedAmount) >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(Number(tx.amount)))}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => openReceipt(tx)}
                        className="rounded p-1 text-[var(--foreground-faint)] hover:bg-gray-100 dark:hover:bg-[#1e2128] hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Imprimer le reçu"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
