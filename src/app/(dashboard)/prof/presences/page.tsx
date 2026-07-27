"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
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

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
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
                <tr key={seance.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
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
                    <Link
                      href={`/prof/presences/${seance.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Enregistrer Présence
                    </Link>
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
