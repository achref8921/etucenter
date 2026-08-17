"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, FileText } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

interface CompteTransaction {
  id: string;
  type: string;
  status: string;
  signedAmount: number;
  description: string;
  paymentMethod: string | null;
  date: string;
  receiptNumber: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  attendance: {
    seance: {
      date: string;
      groupe: { nom: string; matiere: { nom: string } | null };
    };
  } | null;
  reversalOf: { id: string; type: string; amount: number; receiptNumber: string | null } | null;
}

const TYPE_LABEL: Record<string, string> = {
  PREPAYMENT: "Pré-paiement",
  COURSE_CONSUMPTION: "Consommation",
  ADJUSTMENT: "Ajustement",
  REVERSAL: "Annulation",
};

const TYPE_BADGE: Record<string, string> = {
  PREPAYMENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  COURSE_CONSUMPTION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ADJUSTMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  REVERSAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const METHODE_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

export default function EleveComptePage() {
  const [transactions, setTransactions] = useState<CompteTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = filter ? `?type=${filter}` : "";
        const res = await fetch(`/api/eleve/student-finance${params}`);
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setTransactions(data.transactions);
        setBalance(data.balance);
        setNetBalance(data.netBalance ?? data.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filter]);

  const openReceipt = (tx: CompteTransaction) => {
    window.open(`/api/admin/student-finance/${tx.id}/receipt`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mon Compte</h1>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        className={`rounded-xl border p-6 ${
          netBalance > 0
            ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10"
            : netBalance < 0
              ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10"
              : "border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <Wallet className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Mon solde</p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                netBalance > 0
                  ? "text-green-700 dark:text-green-400"
                  : netBalance < 0
                    ? "text-red-700 dark:text-red-400"
                    : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {netBalance > 0 ? "+" : ""}
              {formatCurrency(netBalance)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-neutral-600 dark:text-neutral-400">
          {netBalance > 0
            ? "Solde disponible pour vos cours."
            : netBalance < 0
              ? `Vous devez ${formatCurrency(Math.abs(netBalance))} au centre.`
              : "Votre solde est épuisé."}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-200 dark:border-[#2a2d35] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
            Historique des transactions
          </h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2 py-1.5 text-[12px] text-gray-900 dark:text-gray-100"
          >
            <option value="">Tous les types</option>
            <option value="PREPAYMENT">Pré-paiement</option>
            <option value="COURSE_CONSUMPTION">Consommation</option>
            <option value="ADJUSTMENT">Ajustement</option>
            <option value="REVERSAL">Annulation</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Description</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Montant</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
                    Aucune transaction
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className={`hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] ${tx.status === "reversed" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-600 dark:text-neutral-400">{formatDate(tx.date)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[tx.type] || ""}`}>
                          {TYPE_LABEL[tx.type] || tx.type}
                        </span>
                        {tx.status === "reversed" && (
                          <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            Annulé
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[240px] px-4 py-2.5">
                      <p className="truncate text-[13px] text-gray-900 dark:text-gray-100">{tx.description}</p>
                      {tx.attendance && (
                        <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                          {tx.attendance.seance.groupe.nom}
                          {tx.attendance.seance.groupe.matiere?.nom
                            ? ` — ${tx.attendance.seance.groupe.matiere.nom}`
                            : ""}{" "}
                          · {formatDate(tx.attendance.seance.date)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-semibold tabular-nums ${
                          tx.signedAmount >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {tx.signedAmount >= 0 ? "+" : ""}
                        {formatCurrency(tx.signedAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {tx.receiptNumber ? (
                        <button
                          onClick={() => openReceipt(tx)}
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          {tx.receiptNumber}
                        </button>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500">—</span>
                      )}
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
