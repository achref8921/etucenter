"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  DollarSign,
  AlertTriangle,
  Loader2,
  FileText,
  X,
  Copy,
  Check,
  Calendar,
  Hash,
  MessageSquareText,
} from "lucide-react";
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

const METHODE_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

export default function ElevePaiementsPage() {
  const [groupes, setGroupes] = useState<GroupeFinance[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Paiement | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copyReference = async () => {
    if (!selected?.reference) return;
    try {
      await navigator.clipboard.writeText(selected.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
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
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes Paiements</h1>
      </div>
      <p className="-mt-3 text-[13px] text-neutral-500 dark:text-neutral-400">
        Cliquez sur un paiement pour voir le reçu.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Total Payé</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <DollarSign className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Total Impayé</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(totalUnpaid)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <AlertTriangle className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
            </div>
          </div>
        </div>
      </div>

      {groupes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupes.map((g) => (
            <div key={g.groupe.id} className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{g.groupe.nom}</h3>
              <div className="mt-3 space-y-1 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Payé</span>
                  <span className="font-medium tabular-nums text-green-600 dark:text-green-400">{formatCurrency(g.totalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Impayé</span>
                  <span className={`font-medium tabular-nums ${g.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                    {formatCurrency(g.unpaid)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Historique des Paiements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Montant</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Méthode</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Référence</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {paiements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
                    Aucun paiement enregistré
                  </td>
                </tr>
              ) : (
                paiements.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="cursor-pointer transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                  >
                    <td className="px-4 py-2.5 text-[13px] text-neutral-600 dark:text-neutral-400">{formatDateTime(p.datePaiement)}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline">{p.groupe.nom}</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.montant)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300">
                        {METHODE_LABEL[p.methodePaiement] || p.methodePaiement}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-600 dark:text-neutral-400">{p.reference || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400">
                        Voir le reçu
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md overflow-hidden rounded-xl bg-white dark:bg-[#181b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-emerald-600 px-6 py-4">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-emerald-100">Reçu de paiement</p>
                <p className="text-xl font-bold tabular-nums text-white">{formatCurrency(selected.montant)}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg bg-white/20 p-1.5 text-white hover:bg-white/30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                    <Calendar className="h-4 w-4" /> Date
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatDateTime(selected.datePaiement)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                    <Wallet className="h-4 w-4" /> Groupe
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selected.groupe.nom}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                    <DollarSign className="h-4 w-4" /> Méthode
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {METHODE_LABEL[selected.methodePaiement] || selected.methodePaiement}
                  </span>
                </div>
                {selected.reference && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <Hash className="h-4 w-4" /> Référence
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[12px] font-medium text-gray-900 dark:text-gray-100">
                      {selected.reference}
                      <button
                        onClick={copyReference}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-blue-600 dark:hover:bg-[#1e2128] dark:hover:text-blue-400"
                        title="Copier la référence"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </span>
                  </div>
                )}
                {selected.notes && (
                  <div className="flex items-start gap-2 text-neutral-600 dark:text-neutral-400">
                    <MessageSquareText className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                    <span>{selected.notes}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-neutral-100 dark:border-[#2a2d35] pt-4">
                <button
                  onClick={() => window.open(`/api/paiements/${selected.id}/facture`, "_blank")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-700"
                >
                  <FileText className="h-4 w-4" /> Télécharger la facture
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-[#1e2128]"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
