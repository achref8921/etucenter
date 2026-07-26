"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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

export default function EleveGroupesPage() {
  const [groupes, setGroupes] = useState<GroupeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


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

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {groupes.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-gray-400">
          Vous n&apos;êtes inscrit à aucun groupe
        </div>
      ) : (
        <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupes.map((g) => (
            <div key={g.groupe.id}>
            <div
              className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{g.groupe.nom}</h3>
              {g.groupe.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{g.groupe.description}</p>
              )}

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Matière</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {g.groupe.matiere?.nom ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Prof</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {g.groupe.prof
                      ? `${g.groupe.prof.prenom} ${g.groupe.prof.nom}`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Prix/Mois</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(g.groupe.prixParSeance)}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 dark:border-slate-700 pt-4">
                <h4 className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Finances</h4>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Total dû</span>
                    <span className="text-gray-900 dark:text-gray-100">{formatCurrency(g.stats.totalDue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Total payé</span>
                    <span className="text-green-600 dark:text-green-400">{formatCurrency(g.stats.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Impayé</span>
                    <span
                      className={`font-medium ${g.stats.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}
                    >
                      {formatCurrency(g.stats.unpaid)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}
