"use client";

import { useEffect, useState } from "react";
import { Wallet, DollarSign, AlertTriangle, Loader2, FileText } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface GroupeFinance {
  groupe: { id: string; nom: string };
  totalPaid: number;
  unpaid: number;
}

interface Paiement {
  id: string;
  montant: number;
  datePaiement: string;
  methodePaiement: string;
  reference: string | null;
  notes: string | null;
  groupe: { id: string; nom: string };
}

export default function ElevePaiementsPage() {
  const [groupes, setGroupes] = useState<GroupeFinance[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/eleve/paiements");
        if (!res.ok) throw new Error("Erreur lors du chargement des paiements");
        const data = await res.json();
        setGroupes(data.groupes || []);
        setPaiements(data.paiements || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalPaid = groupes.reduce((sum, g) => sum + g.totalPaid, 0);
  const totalUnpaid = groupes.reduce((sum, g) => sum + g.unpaid, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes Paiements</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Payé</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Impayé</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalUnpaid)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {groupes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupes.map((g) => (
            <div key={g.groupe.id} className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.groupe.nom}</h3>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Payé</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(g.totalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Impayé</span>
                  <span className={`font-medium ${g.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                    {formatCurrency(g.unpaid)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historique des Paiements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Montant</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Méthode</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Référence</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Notes</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {paiements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucun paiement enregistré
                  </td>
                </tr>
              ) : (
                paiements.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDateTime(p.datePaiement)}</td>
                    <td className="px-6 py-4 font-medium">{p.groupe.nom}</td>
                    <td className="px-6 py-4 font-medium">{formatCurrency(p.montant)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-full bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-slate-300">
                        {p.methodePaiement}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{p.reference || "—"}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{p.notes || "—"}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => window.open(`/api/paiements/${p.id}/facture`, "_blank")}
                        className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Télécharger la facture"
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
