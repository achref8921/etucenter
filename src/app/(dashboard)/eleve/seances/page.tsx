"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";

interface Seance {
  id: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  groupe: { id: string; nom: string };
  matiere: { id: string; nom: string } | null;
  prof: { id: string; nom: string; prenom: string } | null;
}

export default function EleveSeancesPage() {
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {seances.map((seance) => (
                <tr key={seance.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(seance.date)}</td>
                  <td className="px-6 py-4 font-medium">{seance.groupe.nom}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {seance.heureDebut && seance.heureFin ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                        {formatTime(seance.heureDebut)}{" "}
                        —{" "}
                        {formatTime(seance.heureFin)}
                      </span>
                    ) : (
                      "\u2014"
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{seance.matiere?.nom ?? "\u2014"}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {seance.prof
                      ? `${seance.prof.prenom} ${seance.prof.nom}`
                      : "\u2014"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        seance.statut === "planifiee"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                          : seance.statut === "en_cours"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                            : seance.statut === "terminee"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {seance.statut === "planifiee"
                        ? "Planifi\u00e9e"
                        : seance.statut === "en_cours"
                          ? "En cours"
                          : seance.statut === "terminee"
                            ? "Termin\u00e9e"
                            : "Annul\u00e9e"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
