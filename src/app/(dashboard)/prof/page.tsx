"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Calendar, ClipboardCheck, FolderOpen, Loader2, Users, DollarSign, TrendingUp } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { SessionUser } from "@/types";

interface GroupeStats {
  id: string;
  nom: string;
  prixParSeance: number;
  nbEleves: number;
  nbSeances: number;
}

interface Stats {
  tauxPourcentage: number;
  totalRevenuRecu: number;
  totalRevenuNet: number;
  totalEleves: number;
  totalSeances: number;
  totalSeancesTerminees: number;
  groupes: GroupeStats[];
}

interface Seance {
  id: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  groupe: { id: string; nom: string };
  _count: { presences: number };
}

export default function ProfDashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const [stats, setStats] = useState<Stats | null>(null);
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [statsRes, seancesRes] = await Promise.all([
          fetch("/api/prof/stats"),
          fetch("/api/prof/seances"),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (seancesRes.ok) {
          const seancesData: Seance[] = await seancesRes.json();
          const now = new Date();
          const upcoming = seancesData
            .filter((s) => new Date(s.date) >= now)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5);
          setSeances(upcoming);
        }
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Bonjour, {user?.prenom ?? "Prof"}
      </h1>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenu Reçu</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(stats.totalRevenuRecu)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ma Part Nette ({stats.tauxPourcentage}%)</p>
                  <p className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.totalRevenuNet)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Mes Élèves</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.totalEleves}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Séances</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.totalSeances}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Groupes</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.groupes.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500">
                  <FolderOpen className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Présences enregistrées</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.totalSeancesTerminees}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500">
                  <ClipboardCheck className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {stats.groupes.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mes Groupes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Élèves</th>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Séances</th>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prix/Mois</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {stats.groupes.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="px-6 py-4 font-medium">{g.nom}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{g.nbEleves}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{g.nbSeances}</td>
                        <td className="px-6 py-4 font-medium">{formatCurrency(g.prixParSeance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prochaines Séances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Nb Présences</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {seances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucune séance à venir
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
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{seance._count.presences}</td>
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
