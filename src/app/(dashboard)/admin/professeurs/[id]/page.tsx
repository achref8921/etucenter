"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Loader2, Wallet, FileText } from "lucide-react";
import { formatDate, formatCurrency, formatTime } from "@/lib/utils";

interface ProfesseurData {
  professeur: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
  };
  groupes: {
    id: string;
    nom: string;
    matiere: { id: string; nom: string } | null;
    _count: { inscriptions: number; seances: number };
  }[];
  seances: {
    id: string;
    date: string;
    heureDebut: string | null;
    heureFin: string | null;
    statut: string;
    groupe: { id: string; nom: string };
    stats: { presentsCount: number; totalEleves: number };
  }[];
}

interface FinanceData {
  balance: number;
  transactions: {
    id: string;
    type: string;
    status: string;
    amount: number;
    signedAmount: number;
    description: string;
    paymentMethod: string | null;
    date: string;
    receiptNumber: string | null;
  }[];
}

export default function AdminProfesseurDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [prof, setProf] = useState<ProfesseurData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [loadingFinance, setLoadingFinance] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/professeurs/${id}`);
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setProf(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    const fetchFinance = async () => {
      try {
        const res = await fetch(`/api/admin/teacher-finance?teacherId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setFinance({ balance: data.balance, transactions: data.transactions });
        }
      } catch {
        // silent
      } finally {
        setLoadingFinance(false);
      }
    };

    fetchData();
    fetchFinance();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !prof) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/utilisateurs"
            className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Détail Professeur</h1>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  const p = prof.professeur;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/utilisateurs"
          className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {p.prenom} {p.nom}
        </h1>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6 ">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <User className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {p.prenom} {p.nom}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{p.email}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Téléphone</p>
            <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{p.telephone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Email</p>
            <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{p.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6 ">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                finance && finance.balance >= 0
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              <Wallet
                className={`h-7 w-7 ${
                  finance && finance.balance >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Compte financier</p>
              {loadingFinance ? (
                <Loader2 className="mt-1 h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              ) : (
                <p
                  className={`mt-1 text-2xl font-bold ${
                    finance && finance.balance >= 0
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {finance && finance.balance !== 0 && (finance.balance > 0 ? "+" : "−")}
                  {formatCurrency(Math.abs(finance?.balance ?? 0))}
                </p>
              )}
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {finance && finance.balance > 0
                  ? "à payer au professeur"
                  : finance && finance.balance < 0
                    ? "à recevoir du professeur"
                    : "solde nul"}
              </p>
            </div>
          </div>
          <Link
            href={`/admin/finances-professeurs?teacherId=${p.id}`}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 sm:self-auto"
          >
            <Wallet className="h-4 w-4" />
            Voir le grand livre
          </Link>
        </div>

        {!loadingFinance && finance && finance.transactions.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
                <tr>
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Type</th>
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Description</th>
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Montant</th>
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
                {finance.transactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id} className={tx.status === "reversed" ? "opacity-50" : ""}>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.type === "REVERSAL"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : tx.type === "PAYMENT"
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                              : tx.type === "EARNING"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400"
                        }`}
                      >
                        {tx.type === "REVERSAL"
                          ? "Annulation"
                          : tx.type === "PAYMENT"
                            ? "Paiement"
                            : tx.type === "EARNING"
                              ? "Gain"
                              : "Ajustement"}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {tx.description}
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        Number(tx.signedAmount) >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {Number(tx.signedAmount) >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(Number(tx.amount)))}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          window.open(`/api/admin/teacher-finance/${tx.id}/receipt`, "_blank")
                        }
                        className="rounded p-1 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Imprimer le reçu"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ses Groupes</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Matière</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Élèves</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Séances</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {prof.groupes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400">
                  Aucun groupe assigné
                </td>
              </tr>
            ) : (
              prof.groupes.map((g) => (
                <tr key={g.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/admin/groupes/${g.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {g.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{g.matiere?.nom ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{g._count.inscriptions}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{g._count.seances}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ses Séances</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Horaire</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Statut</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Présences</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {prof.seances.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400">
                  Aucune séance
                </td>
              </tr>
            ) : (
              prof.seances.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{formatDate(s.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{s.groupe.nom}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {s.heureDebut && s.heureFin
                      ? `${formatTime(s.heureDebut)} - ${formatTime(s.heureFin)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.statut === "planifiee"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                          : s.statut === "en_cours"
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                            : s.statut === "terminee"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                              : "bg-neutral-100 dark:bg-[#2a2d35] text-neutral-800 dark:text-neutral-200"
                      }`}
                    >
                      {s.statut === "planifiee"
                        ? "Planifiée"
                        : s.statut === "en_cours"
                          ? "En cours"
                          : s.statut === "terminee"
                            ? "Terminée"
                            : "Annulée"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {s.stats.presentsCount}/{s.stats.totalEleves}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
