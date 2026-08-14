"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  DollarSign,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar,
  User,
  BookOpen,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SessionUser } from "@/types";

interface GroupeData {
  inscription: {
    id: string;
    dateInscription: string;
    statut: string;
  };
  groupe: {
    id: string;
    nom: string;
    description: string | null;
    prixParSeance: number;
    prof: { id: string; nom: string; prenom: string } | null;
    matiere: { id: string; nom: string } | null;
  };
  stats: {
    totalDue: number;
    totalPaid: number;
    unpaid: number;
  };
}

export default function EleveDashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const router = useRouter();
  const [groupes, setGroupes] = useState<GroupeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/eleve/groupes");
        if (!res.ok) throw new Error("Erreur lors du chargement des groupes");
        const data = await res.json();
        setGroupes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalPaid = groupes.reduce((sum, g) => sum + g.stats.totalPaid, 0);
  const totalUnpaid = groupes.reduce((sum, g) => sum + g.stats.unpaid, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bonjour, {user?.prenom ?? "Élève"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cliquez sur une carte ou une ligne pour plus de détails.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/eleve/groupes"
          className="group rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Groupes</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{groupes.length}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                Voir mes groupes <ChevronRight className="h-3 w-3" />
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
          </div>
        </Link>
        <Link
          href="/eleve/paiements"
          className="group rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-green-300 dark:hover:border-green-700 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Payé</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalPaid)}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                Voir mes paiements <ChevronRight className="h-3 w-3" />
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </Link>
        <Link
          href="/eleve/paiements"
          className="group rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 dark:hover:border-red-700 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Impayé</p>
              <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{formatCurrency(totalUnpaid)}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                Régler mon compte <ChevronRight className="h-3 w-3" />
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
          </div>
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mes Groupes</h2>
          <Link
            href="/eleve/groupes"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Matière</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prof</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prix/Séance</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {groupes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Vous n&apos;êtes inscrit à aucun groupe
                  </td>
                </tr>
              ) : (
                groupes.map((g) => {
                  const isExpanded = expandedId === g.groupe.id;
                  const payPercent =
                    g.stats.totalDue > 0
                      ? Math.min(100, Math.round((g.stats.totalPaid / g.stats.totalDue) * 100))
                      : 0;
                  return (
                    <FragmentRow
                      key={g.groupe.id}
                      g={g}
                      isExpanded={isExpanded}
                      payPercent={payPercent}
                      onToggle={() => setExpandedId(isExpanded ? null : g.groupe.id)}
                      onOpen={() => router.push("/eleve/groupes")}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  g,
  isExpanded,
  payPercent,
  onToggle,
  onOpen,
}: {
  g: GroupeData;
  isExpanded: boolean;
  payPercent: number;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40"
      >
        <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400 hover:underline">{g.groupe.nom}</td>
        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
          {g.groupe.matiere ? (
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              {g.groupe.matiere.nom}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
          {g.groupe.prof ? (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              {g.groupe.prof.prenom} {g.groupe.prof.nom}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatCurrency(g.groupe.prixParSeance)}</td>
        <td className="px-6 py-4">
          {g.stats.unpaid > 0 ? (
            <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Impayé
            </span>
          ) : (
            <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              À jour
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-right">
          {isExpanded ? (
            <ChevronUp className="ml-auto h-4 w-4 text-gray-400 dark:text-gray-500" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-gray-400 dark:text-gray-500" />
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-50 dark:bg-slate-800">
          <td colSpan={6} className="px-6 py-5">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-3 text-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Informations
                </h3>
                {g.groupe.description && (
                  <p className="text-gray-600 dark:text-gray-400">{g.groupe.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    Prof :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {g.groupe.prof ? `${g.groupe.prof.prenom} ${g.groupe.prof.nom}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    Inscrit le :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(g.inscription.dateInscription)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <BookOpen className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    Matière :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {g.groupe.matiere?.nom ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Ma situation financière
                </h3>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Réglé à {payPercent}%</span>
                    <span>
                      {formatCurrency(g.stats.totalPaid)} / {formatCurrency(g.stats.totalDue)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all ${
                        g.stats.unpaid > 0 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${payPercent}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                    <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500">Total dû</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(g.stats.totalDue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                    <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500">Payé</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(g.stats.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                    <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500">Impayé</p>
                    <p
                      className={`text-sm font-bold ${
                        g.stats.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {formatCurrency(g.stats.unpaid)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2">
                <button
                  onClick={onOpen}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Détails du groupe <ChevronRight className="h-4 w-4" />
                </button>
                <Link
                  href="/eleve/paiements"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  <DollarSign className="h-4 w-4" /> Voir mes paiements
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
