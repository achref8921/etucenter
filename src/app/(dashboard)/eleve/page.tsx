"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { GraduationCap, DollarSign, AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Bonjour, {user?.prenom ?? "Élève"}
      </h1>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Groupes</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{groupes.length}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Payé</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Impayé</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalUnpaid)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mes Groupes</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Matière</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prof</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prix/Mois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {groupes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Vous n&apos;êtes inscrit à aucun groupe
                </td>
              </tr>
            ) : (
              groupes.map((g) => (
                <tr key={g.groupe.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 font-medium">{g.groupe.nom}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{g.groupe.matiere?.nom ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {g.groupe.prof
                      ? `${g.groupe.prof.prenom} ${g.groupe.prof.nom}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {formatCurrency(g.groupe.prixParSeance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
