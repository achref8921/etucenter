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
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Enregistrer les Présences</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="hidden md:block overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
          <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Statut</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {seances.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-center text-neutral-500 dark:text-neutral-400">
                  Aucune séance disponible
                </td>
              </tr>
            ) : (
              seances.map((seance) => (
                <tr key={seance.id} className="transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/30">
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{formatDate(seance.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{seance.groupe.nom}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                        seance.statut === "planifiee"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          : seance.statut === "en_cours"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : seance.statut === "terminee"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
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
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/prof/presences/${seance.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white transition-all hover:bg-indigo-700"
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
          <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
            Aucune séance disponible
          </div>
        ) : (
          seances.map((seance) => (
            <Link
              key={seance.id}
              href={`/prof/presences/${seance.id}`}
              className="block rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-4 transition-all hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-neutral-900 dark:text-neutral-100">{seance.groupe.nom}</p>
                  <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">{formatDate(seance.date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                      seance.statut === "planifiee"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : seance.statut === "en_cours"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : seance.statut === "terminee"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
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
                  <ChevronRight className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3 dark:border-[#2a2d35]">
                <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-[12px] font-semibold text-blue-600 dark:text-blue-400">
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
