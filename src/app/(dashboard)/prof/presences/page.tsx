"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { SkeletonPage } from "@/components/ui/skeleton";

interface Seance {
  id: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  groupe: { id: string; nom: string };
  _count: { presences: number };
}

export default function ProfPresencesSelectPage() {
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/prof/seances");
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
    return <SkeletonPage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Enregistrer les Présences</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {seances.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucune séance disponible
                </td>
              </tr>
            ) : (
              seances.map((seance) => (
                <tr key={seance.id} className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30">
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(seance.date)}</td>
                  <td className="px-6 py-4 font-medium">{seance.groupe.nom}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        seance.statut === "planifiee"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          : seance.statut === "en_cours"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : seance.statut === "terminee"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {seance.statut === "planifiee"
                        ? "Planifiée"
                        : seance.statut === "en_cours"
                          ? "En cours"
                          : seance.statut === "terminee"
                            ? "Terminée"
                            : "Annulée"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/prof/presences/${seance.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-blue-700 hover:shadow-md"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {seance.statut === "terminee" ? "Voir les présences" : "Enregistrer Présence"}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {seances.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucune séance disponible
          </div>
        ) : (
          seances.map((seance) => (
            <Link
              key={seance.id}
              href={`/prof/presences/${seance.id}`}
              className="block rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:hover:border-blue-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{seance.groupe.nom}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(seance.date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      seance.statut === "planifiee"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : seance.statut === "en_cours"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : seance.statut === "terminee"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {seance.statut === "planifiee"
                      ? "Planifiée"
                      : seance.statut === "en_cours"
                        ? "En cours"
                        : seance.statut === "terminee"
                          ? "Terminée"
                          : "Annulée"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-300 dark:text-slate-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
                <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {seance.statut === "terminee" ? "Voir les présences" : "Enregistrer Présence"}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
