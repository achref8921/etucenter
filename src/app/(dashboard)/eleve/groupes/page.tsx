"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  BookOpen,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

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
    prof: { id: string; nom: string; prenom: string; telephone: string | null; email: string } | null;
    matiere: { id: string; nom: string } | null;
  };
  stats: {
    totalDue: number;
    totalPaid: number;
    remainingCredit: number;
    unpaid: number;
  };
  seances: { total: number; aVenir: number };
  presences: { present: number; absent: number };
}

export default function EleveGroupesPage() {
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
        <GraduationCap className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes Groupes</h1>
      </div>
      <p className="-mt-3 text-[13px] text-neutral-500 dark:text-neutral-400">
        Cliquez sur un groupe pour plus de détails.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {groupes.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
          Vous n&apos;êtes inscrit à aucun groupe
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupes.map((g) => {
            const isExpanded = expandedId === g.groupe.id;
            return (
              <div
                key={g.groupe.id}
                className="overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] transition-all"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : g.groupe.id)}
                  className="w-full p-6 text-left transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">{g.groupe.nom}</h3>
                      {g.groupe.matiere && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                          <BookOpen className="h-3.5 w-3.5" /> {g.groupe.matiere.nom}
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Prof</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {g.groupe.prof ? `${g.groupe.prof.prenom} ${g.groupe.prof.nom}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 dark:text-neutral-400">Prix/Séance</span>
                      <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(g.groupe.prixParSeance)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-neutral-100 dark:border-[#2a2d35] pt-4">
                    <div className="mt-2 flex items-center justify-between text-[13px]">
                      <span className="text-neutral-500 dark:text-neutral-400">Solde</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          g.stats.remainingCredit > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : g.stats.remainingCredit < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {g.stats.remainingCredit > 0 ? "+" : ""}{formatCurrency(g.stats.remainingCredit)}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-neutral-100 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#181b22] p-6">
                    {g.groupe.description && (
                      <p className="mb-4 text-[13px] text-neutral-600 dark:text-neutral-400">{g.groupe.description}</p>
                    )}

                    <div className="mb-4 space-y-2 text-[13px]">
                      <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                        <Calendar className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        Inscrit le :{" "}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatDate(g.inscription.dateInscription)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                        <Clock className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        Séances :{" "}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {g.seances.total} au total
                          {g.seances.aVenir > 0 && (
                            <span className="text-blue-600 dark:text-blue-400"> — {g.seances.aVenir} à venir</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
                        <User className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        Présences :
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {g.presences.present}
                        </span>
                        <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> {g.presences.absent}
                        </span>
                      </div>
                    </div>

                    {g.groupe.prof && (
                      <div className="mb-4 rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                          Contacter le prof
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {g.groupe.prof.telephone && (
                            <a
                              href={`tel:${g.groupe.prof.telephone}`}
                              className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                            >
                              <Phone className="h-3.5 w-3.5" /> Appeler
                            </a>
                          )}
                          {g.groupe.prof.email && (
                            <a
                              href={`mailto:${g.groupe.prof.email}`}
                              className="flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-[12px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              <Mail className="h-3.5 w-3.5" /> Email
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/eleve/seances"
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-700"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Mes séances
                      </Link>
                      <Link
                        href="/eleve/presences"
                        className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-[#2a2d35] dark:text-neutral-300 dark:hover:bg-[#1e2128]"
                      >
                        Présences <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href="/eleve/paiements"
                        className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-[#2a2d35] dark:text-neutral-300 dark:hover:bg-[#1e2128]"
                      >
                        Paiements <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
