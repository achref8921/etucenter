"use client";

import { useEffect, useState, Fragment } from "react";
import { Calendar, Clock, Loader2, ChevronDown, ChevronUp, User, BookOpen, Phone, Mail, StickyNote } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";

interface Seance {
  id: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  notes: string | null;
  groupe: {
    id: string;
    nom: string;
    matiere: { id: string; nom: string } | null;
    prof: { id: string; nom: string; prenom: string; telephone: string | null; email: string } | null;
  };
}

const statusColor = (s: string) => {
  if (s === "planifiee") return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
  if (s === "en_cours") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
  if (s === "terminee") return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
  return "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300";
};

const statusLabel = (s: string) => {
  if (s === "planifiee") return "Planifiée";
  if (s === "en_cours") return "En cours";
  if (s === "terminee") return "Terminée";
  return "Annulée";
};

export default function EleveSeancesPage() {
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/eleve/seances");
        if (!res.ok) throw new Error("Erreur lors du chargement des séances");
        const data = await res.json();
        setSeances(data);
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
        <Calendar className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes Séances</h1>
      </div>
      <p className="-mt-3 text-sm text-gray-500 dark:text-gray-400">
        Cliquez sur une séance pour plus de détails.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {seances.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-gray-400">
          Aucune séance à venir
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Horaire</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Matière</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prof</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {seances.map((seance) => {
                  const isExpanded = expandedId === seance.id;
                  return (
                    <Fragment key={seance.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : seance.id)}
                        className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                          {formatDate(seance.date)}
                        </td>
                        <td className="px-6 py-4 text-blue-600 dark:text-blue-400 hover:underline">{seance.groupe.nom}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {seance.heureDebut && seance.heureFin ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                              {formatTime(seance.heureDebut)} — {formatTime(seance.heureFin)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {seance.groupe.matiere ? (
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                              {seance.groupe.matiere.nom}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {seance.groupe.prof ? (
                            <span className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                              {seance.groupe.prof.prenom} {seance.groupe.prof.nom}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(
                              seance.statut
                            )}`}
                          >
                            {statusLabel(seance.statut)}
                          </span>
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
                          <td colSpan={7} className="px-6 py-5">
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                              <div className="space-y-2 text-sm">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                  Séance
                                </h3>
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                                  {formatDate(seance.date)}
                                  {seance.heureDebut && seance.heureFin && (
                                    <span>
                                      · {formatTime(seance.heureDebut)} - {formatTime(seance.heureFin)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <BookOpen className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                                  {seance.groupe.matiere?.nom ?? "—"}
                                </div>
                              </div>

                              <div className="space-y-2 text-sm">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                  Professeur
                                </h3>
                                {seance.groupe.prof ? (
                                  <>
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                      <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                                      {seance.groupe.prof.prenom} {seance.groupe.prof.nom}
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {seance.groupe.prof.telephone && (
                                        <a
                                          href={`tel:${seance.groupe.prof.telephone}`}
                                          className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        >
                                          <Phone className="h-3.5 w-3.5" /> Appeler
                                        </a>
                                      )}
                                      {seance.groupe.prof.email && (
                                        <a
                                          href={`mailto:${seance.groupe.prof.email}`}
                                          className="flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                                        >
                                          <Mail className="h-3.5 w-3.5" /> Email
                                        </a>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-gray-400 dark:text-gray-500">—</p>
                                )}
                              </div>

                              <div className="space-y-2 text-sm">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                  Statut & notes
                                </h3>
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(
                                    seance.statut
                                  )}`}
                                >
                                  {statusLabel(seance.statut)}
                                </span>
                                {seance.notes && (
                                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                                    <StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                                    <span>{seance.notes}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
