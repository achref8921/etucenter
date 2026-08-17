"use client";

import { useEffect, useState } from "react";
import { Wallet, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import { SkeletonPage } from "@/components/ui/skeleton";

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

export default function ProfComptePage() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayBalance, setDisplayBalance] = useState(0);

  useEffect(() => {
    if (balance === 0) {
      setDisplayBalance(0);
      return;
    }
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayBalance(balance * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [balance]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/prof/teacher-finance");
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setTransactions(data.transactions);
        setBalance(data.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <SkeletonPage />;
  }

  const openReceipt = (tx: TransactionRow) => {
    window.open(`/api/prof/teacher-finance/${tx.id}/receipt`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/prof"
          className="flex items-center gap-1 text-[13px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Mon Compte</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        className={`animate-fade-in-up rounded-xl border p-6 ${
          balance >= 0
            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
            : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-[13px] font-medium ${
                balance >= 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {balance >= 0 ? "Solde à percevoir" : "Solde dû au centre"}
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                balance >= 0
                  ? "text-green-900 dark:text-green-100"
                  : "text-red-900 dark:text-red-100"
              }`}
            >
              {balance !== 0 && (balance > 0 ? "+" : "−")}
              {formatCurrency(Math.abs(displayBalance))}
            </p>
            <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
              {balance > 0
                ? "Le centre vous doit ce montant."
                : balance < 0
                  ? "Ce montant est à régler au centre."
                  : "Votre solde est nul."}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-[#181b22]">
            <Wallet className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] px-5 py-3">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Historique des transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Description</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Méthode</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Montant</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400">
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
                    <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
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
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400"
                        }`}
                      >
                        {TYPE_LABEL[tx.type]}
                      </span>
                      {tx.status === "reversed" && (
                        <span className="ml-1 inline-block rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-[12px] text-neutral-600 dark:text-neutral-300">
                          Annulé
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-2.5">
                      <p className="truncate text-neutral-600 dark:text-neutral-400">{tx.description}</p>
                      {tx.receiptNumber && (
                        <p className="text-[12px] text-neutral-400 dark:text-neutral-500">{tx.receiptNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
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
                        className="rounded p-1 text-neutral-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-[#1e2128] hover:text-emerald-600 dark:hover:text-emerald-400"
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
