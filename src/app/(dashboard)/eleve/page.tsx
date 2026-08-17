"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  DollarSign,
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
    remainingCredit: number;
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

  const totalRemaining = groupes.reduce((sum, g) => sum + g.stats.remainingCredit, 0);


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
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
          Cliquez sur une carte ou une ligne pour plus de détails.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/eleve/groupes"
          className="group rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6 transition-all hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Total Groupes</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{groupes.length}</p>
              <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                Voir mes groupes <ChevronRight className="h-3 w-3" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <GraduationCap className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
            </div>
          </div>
        </Link>
        <Link
          href="/eleve/paiements"
          className={`group rounded-xl border bg-white dark:bg-[#181b22] p-6 transition-all hover:-translate-y-0.5 ${
            totalRemaining > 0
              ? "border-green-200 dark:border-[#2a2d35] dark:hover:border-green-700"
              : totalRemaining < 0
                ? "border-red-200 dark:border-[#2a2d35] dark:hover:border-red-700"
                : "border-neutral-200 dark:border-[#2a2d35] dark:hover:border-gray-600"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Mon Solde</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${
                totalRemaining > 0
                  ? "text-green-600 dark:text-green-400"
                  : totalRemaining < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-900 dark:text-gray-100"
              }`}>
                {totalRemaining > 0 ? "+" : ""}{formatCurrency(totalRemaining)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                Voir mes paiements <ChevronRight className="h-3 w-3" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <DollarSign className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
            </div>
          </div>
        </Link>

      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#2a2d35] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Mes Groupes</h2>
          <Link
            href="/eleve/groupes"
            className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Matière</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Prof</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Prix/Séance</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {groupes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
                    Vous n&apos;êtes inscrit à aucun groupe
                  </td>
                </tr>
              ) : (
                groupes.map((g) => {
                  const isExpanded = expandedId === g.groupe.id;
                  return (
                    <FragmentRow
                      key={g.groupe.id}
                      g={g}
                      isExpanded={isExpanded}
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
  onToggle,
  onOpen,
}: {
  g: GroupeData;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
      >
        <td className="px-4 py-2.5 text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline">{g.groupe.nom}</td>
        <td className="px-4 py-2.5 text-[13px] text-neutral-600 dark:text-neutral-400">
          {g.groupe.matiere ? (
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
              {g.groupe.matiere.nom}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-2.5 text-[13px] text-neutral-600 dark:text-neutral-400">
          {g.groupe.prof ? (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
              {g.groupe.prof.prenom} {g.groupe.prof.nom}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-2.5 text-[13px] tabular-nums text-neutral-600 dark:text-neutral-400">{formatCurrency(g.groupe.prixParSeance)}</td>
        <td className="px-4 py-2.5">
          {g.stats.unpaid > 0 ? (
            <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Impayé
            </span>
          ) : (
            <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              À jour
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 text-right">
          {isExpanded ? (
            <ChevronUp className="ml-auto h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-neutral-50 dark:bg-[#181b22]">
          <td colSpan={6} className="px-4 py-5">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-3 text-[13px]">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Informations
                </h3>
                {g.groupe.description && (
                  <p className="text-neutral-600 dark:text-neutral-400">{g.groupe.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                    <User className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    Prof :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {g.groupe.prof ? `${g.groupe.prof.prenom} ${g.groupe.prof.nom}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                    <Calendar className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    Inscrit le :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(g.inscription.dateInscription)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                    <BookOpen className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    Matière :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {g.groupe.matiere?.nom ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-[13px]">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Ma situation financière
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-3 py-2">
                    <p className="text-[11px] uppercase text-neutral-400 dark:text-neutral-500">Total dû</p>
                    <p className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(g.stats.totalDue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-3 py-2">
                    <p className="text-[11px] uppercase text-neutral-400 dark:text-neutral-500">Payé</p>
                    <p className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(g.stats.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-3 py-2">
                    <p className="text-[11px] uppercase text-neutral-400 dark:text-neutral-500">Solde</p>
                    <p
                      className={`text-[13px] font-bold tabular-nums ${
                        g.stats.remainingCredit > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : g.stats.remainingCredit < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {g.stats.remainingCredit > 0 ? "+" : ""}{formatCurrency(g.stats.remainingCredit)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2">
                <button
                  onClick={onOpen}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
                >
                  Détails du groupe <ChevronRight className="h-4 w-4" />
                </button>
                <Link
                  href="/eleve/paiements"
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-[#2a2d35] dark:text-neutral-300 dark:hover:bg-[#1e2128]"
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
