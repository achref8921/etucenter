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
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        className={`rounded-lg border p-6 shadow-sm ${
          balance > 0
            ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10"
            : balance < 0
              ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10"
              : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              balance > 0 ? "bg-green-500" : balance < 0 ? "bg-red-500" : "bg-gray-400 dark:bg-slate-600"
            }`}
          >
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Mon solde prépayé</p>
            <p
              className={`text-3xl font-bold ${
                balance > 0
                  ? "text-green-700 dark:text-green-400"
                  : balance < 0
                    ? "text-red-700 dark:text-red-400"
                    : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {balance > 0 ? "+" : ""}
              {formatCurrency(balance)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {balance > 0
            ? "Solde prépayé disponible pour vos cours."
            : balance < 0
              ? `Vous devez ${formatCurrency(Math.abs(balance))} au centre.`
              : "Votre solde est épuisé."}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Historique des transactions
          </h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100"
          >
            <option value="">Tous les types</option>
            <option value="PREPAYMENT">Pré-paiement</option>
            <option value="COURSE_CONSUMPTION">Consommation</option>
            <option value="ADJUSTMENT">Ajustement</option>
            <option value="REVERSAL">Annulation</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Montant</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                    Aucune transaction
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 ${tx.status === "reversed" ? "opacity-50" : ""}`}>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(tx.date)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_BADGE[tx.type] || ""}`}>
                          {TYPE_LABEL[tx.type] || tx.type}
                        </span>
                        {tx.status === "reversed" && (
                          <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                            Annulé
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[240px] px-6 py-4">
                      <p className="truncate text-gray-900 dark:text-gray-100">{tx.description}</p>
                      {tx.attendance && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {tx.attendance.seance.groupe.nom}
                          {tx.attendance.seance.groupe.matiere?.nom
                            ? ` — ${tx.attendance.seance.groupe.matiere.nom}`
                            : ""}{" "}
                          · {formatDate(tx.attendance.seance.date)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-semibold ${
                          tx.signedAmount >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {tx.signedAmount >= 0 ? "+" : ""}
                        {formatCurrency(tx.signedAmount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tx.receiptNumber ? (
                        <button
                          onClick={() => openReceipt(tx)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          {tx.receiptNumber}
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
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
