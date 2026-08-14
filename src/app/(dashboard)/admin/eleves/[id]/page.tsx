"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Loader2, Wallet, ArrowUpRight, CheckCircle2, AlertCircle, ClipboardCheck } from "lucide-react";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";

interface EleveData {
  eleve: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    dateNaissance: string | null;
    codeEleve: string | null;
    niveau: string | null;
    classe: string | null;
    filiere: string | null;
    actif: boolean;
    emailVerified: string | null;
    createdAt: string;
  };
  inscriptions: {
    id: string;
    groupe: { id: string; nom: string; matiere: { id: string; nom: string } | null; prof: { id: string; nom: string; prenom: string } | null };
    stats: { presencesCount: number; absencesCount: number; totalDue: number; totalPaid: number; unpaid: number };
  }[];
  paiements: {
    id: string;
    montant: number;
    datePaiement: string;
    methodePaiement: string;
    notes: string | null;
    groupe: { id: string; nom: string };
  }[];
  presences: {
    id: string;
    statut: string;
    seance: {
      id: string;
      date: string;
      statut: string;
      groupe: {
        id: string;
        nom: string;
        matiere: { nom: string } | null;
        prof: { id: string; nom: string; prenom: string } | null;
      };
    };
  }[];
}

type StudentTransaction = {
  id: string;
  type: string;
  status: string;
  signedAmount: number;
  description: string;
  date: string;
  receiptNumber: string | null;
  attendance?: {
    seance: { date: string; groupe: { id: string; nom: string } };
  } | null;
};

const transactionLabel = (type: string) => {
  switch (type) {
    case "PREPAYMENT":
      return "Pré-paiement";
    case "COURSE_CONSUMPTION":
      return "Consommation de cours";
    case "ADJUSTMENT":
      return "Ajustement";
    case "REVERSAL":
      return "Annulation";
    default:
      return type;
  }
};

export default function AdminEleveDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [eleve, setEleve] = useState<EleveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [financeBalance, setFinanceBalance] = useState<number | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [transactions, setTransactions] = useState<StudentTransaction[]>([]);
  const [presenceFilter, setPresenceFilter] = useState<"toutes" | "present" | "absent">("toutes");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/eleves/${id}`);
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setEleve(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchBalance = async () => {
      try {
        setFinanceLoading(true);
        const res = await fetch(`/api/admin/student-finance?studentId=${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setFinanceBalance(data.balance);
        setTransactions(data.transactions ?? []);
      } catch {
        setFinanceBalance(null);
      } finally {
        setFinanceLoading(false);
      }
    };
    fetchBalance();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !eleve) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/utilisateurs"
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Détail Élève</h1>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  const e = eleve.eleve;
  const presents = eleve.presences.filter((p) => p.statut === "present").length;
  const absents = eleve.presences.length - presents;
  const attendanceRate =
    eleve.presences.length > 0 ? Math.round((presents / eleve.presences.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/utilisateurs"
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {e.prenom} {e.nom}
        </h1>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <User className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {e.prenom} {e.nom}
              </h2>
              {e.codeEleve && (
                <span className="inline-block rounded bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                  #{e.codeEleve}
                </span>
              )}
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  e.actif
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                {e.actif ? "Actif" : "Suspendu"}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {e.email}
              {e.emailVerified ? (
                <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> Vérifié
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" /> Email non vérifié
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Membre depuis le {formatDate(e.createdAt)}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Téléphone</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.telephone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Date de naissance</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {e.dateNaissance ? formatDate(e.dateNaissance) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Email</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Niveau</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {e.niveau === "primaire" ? "Primaire" : e.niveau === "college" ? "Collège" : e.niveau === "lycee" ? "Lycée" : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Classe</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.classe || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Filière</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.filiere ? e.filiere.charAt(0).toUpperCase() + e.filiere.slice(1) : "—"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                financeBalance === null
                  ? "bg-gray-400 dark:bg-slate-600"
                  : financeBalance > 0
                    ? "bg-green-500"
                    : financeBalance < 0
                      ? "bg-red-500"
                      : "bg-gray-400 dark:bg-slate-600"
              }`}
            >
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Compte financier</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Solde prépayé</p>
            </div>
          </div>
          <Link
            href={`/admin/finances?studentId=${e.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Voir le grand livre <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p
              className={`text-3xl font-bold ${
                financeBalance === null
                  ? "text-gray-400 dark:text-gray-500"
                  : financeBalance > 0
                    ? "text-green-600 dark:text-green-400"
                    : financeBalance < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {financeLoading
                ? "..."
                : financeBalance === null
                  ? "—"
                  : `${financeBalance > 0 ? "+" : ""}${formatCurrency(financeBalance)}`}
            </p>
            {!financeLoading && financeBalance !== null && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {financeBalance > 0
                  ? "Solde prépayé disponible"
                  : financeBalance < 0
                    ? `L'élève doit ${formatCurrency(Math.abs(financeBalance))} au centre`
                    : "Solde épuisé"}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500 shadow-md shadow-purple-200 dark:shadow-purple-900/30">
            <ClipboardCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assiduité</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {presents} présences · {absents} absences · {eleve.presences.length} séance{eleve.presences.length > 1 ? "s" : ""} enregistrée{eleve.presences.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{attendanceRate}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Taux de présence</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                attendanceRate >= 70
                  ? "bg-green-500"
                  : attendanceRate >= 40
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Groupes Inscrits</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Matière</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prof</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Présences</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Absences</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Total Dû</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Total Payé</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Impayé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {eleve.inscriptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucun groupe inscrit
                </td>
              </tr>
            ) : (
              eleve.inscriptions.map((ins) => (
                <tr key={ins.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 font-medium">
                    <Link href={`/admin/groupes/${ins.groupe.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {ins.groupe.nom}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{ins.groupe.matiere?.nom ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {ins.groupe.prof
                      ? `${ins.groupe.prof.prenom} ${ins.groupe.prof.nom}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-green-600 dark:text-green-400">{ins.stats.presencesCount}</td>
                  <td className="px-6 py-4 text-red-600 dark:text-red-400">{ins.stats.absencesCount}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatCurrency(ins.stats.totalDue)}</td>
                  <td className="px-6 py-4 text-green-600 dark:text-green-400">{formatCurrency(ins.stats.totalPaid)}</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${ins.stats.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                      {formatCurrency(ins.stats.unpaid)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historique des Présences</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {eleve.presences.filter((p) => p.statut === "present").length} présents ·{" "}
              {eleve.presences.filter((p) => p.statut === "absent").length} absents
            </span>
            <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 p-0.5">
              {(["toutes", "present", "absent"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPresenceFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    presenceFilter === f
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700"
                  }`}
                >
                  {f === "toutes" ? "Toutes" : f === "present" ? "Présents" : "Absents"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Matière</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prof</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {eleve.presences.filter((p) => presenceFilter === "toutes" || p.statut === presenceFilter).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {eleve.presences.length === 0
                      ? "Aucune présence enregistrée"
                      : "Aucune présence dans cette catégorie"}
                  </td>
                </tr>
              ) : (
                eleve.presences
                  .filter((p) => presenceFilter === "toutes" || p.statut === presenceFilter)
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(p.seance.date)}</td>
                      <td className="px-6 py-4 font-medium">
                        <Link href={`/admin/groupes/${p.seance.groupe.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                          {p.seance.groupe.nom}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{p.seance.groupe.matiere?.nom ?? "—"}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {p.seance.groupe.prof ? `${p.seance.groupe.prof.prenom} ${p.seance.groupe.prof.nom}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            p.statut === "present"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {p.statut === "present" ? "Présent" : "Absent"}
                        </span>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Grand Livre</h2>
          <Link
            href={`/admin/finances?studentId=${e.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Voir tout <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucune transaction enregistrée
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 10).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDateTime(t.date)}</td>
                    <td className="px-6 py-4 font-medium">
                      {t.description}
                      {t.receiptNumber && (
                        <span className="ml-2 inline-block rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                          {t.receiptNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {t.attendance?.seance.groupe.nom ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          t.type === "PREPAYMENT"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : t.type === "COURSE_CONSUMPTION"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : t.type === "REVERSAL"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {transactionLabel(t.type)}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 font-semibold ${
                        t.signedAmount >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {t.signedAmount >= 0 ? "+" : ""}{formatCurrency(t.signedAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historique des Paiements</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Montant</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Méthode</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {eleve.paiements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucun paiement enregistré
                </td>
              </tr>
            ) : (
              eleve.paiements.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDateTime(p.datePaiement)}</td>
                  <td className="px-6 py-4 font-medium">{p.groupe.nom}</td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(p.montant)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded-full bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                      {p.methodePaiement}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{p.notes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
