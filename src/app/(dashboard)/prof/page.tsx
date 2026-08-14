"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ClipboardCheck,
  FolderOpen,
  Loader2,
  Users,
  DollarSign,
  TrendingUp,
  ChevronRight,
  ClipboardList,
  Plus,
} from "lucide-react";
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

const statusColor = (s: string) => {
  if (s === "planifiee") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (s === "en_cours") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (s === "terminee") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
};

const statusLabel = (s: string) => {
  if (s === "planifiee") return "Planifiée";
  if (s === "en_cours") return "En cours";
  if (s === "terminee") return "Terminée";
  return "Annulée";
};

function StatCard({
  label,
  value,
  icon,
  iconBg,
  href,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  href: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
            {hint} <ChevronRight className="h-3 w-3" />
          </p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      </div>
    </Link>
  );
}

export default function ProfDashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const router = useRouter();
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
            .filter((s) => new Date(s.date) >= now && s.statut !== "annulee")
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bonjour, {user?.prenom ?? "Prof"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cliquez sur une carte ou une ligne pour plus de détails.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Revenu Reçu"
              value={formatCurrency(stats.totalRevenuRecu)}
              icon={<DollarSign className="h-6 w-6 text-white" />}
              iconBg="bg-blue-500"
              href="/prof/compte"
              hint="Voir mon compte"
            />
            <StatCard
              label={`Ma Part Nette (${stats.tauxPourcentage}%)`}
              value={<span className="text-green-600 dark:text-green-400">{formatCurrency(stats.totalRevenuNet)}</span>}
              icon={<TrendingUp className="h-6 w-6 text-white" />}
              iconBg="bg-green-500"
              href="/prof/compte"
              hint="Voir mes gains"
            />
            <StatCard
              label="Mes Élèves"
              value={stats.totalEleves}
              icon={<Users className="h-6 w-6 text-white" />}
              iconBg="bg-purple-500"
              href="/prof/eleves"
              hint="Voir la liste"
            />
            <StatCard
              label="Séances"
              value={stats.totalSeances}
              icon={<Calendar className="h-6 w-6 text-white" />}
              iconBg="bg-amber-500"
              href="/prof/seances"
              hint="Gérer mes séances"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              label="Groupes"
              value={stats.groupes.length}
              icon={<FolderOpen className="h-6 w-6 text-white" />}
              iconBg="bg-indigo-500"
              href="/prof/groupes"
              hint="Gérer mes groupes"
            />
            <StatCard
              label="Présences enregistrées"
              value={stats.totalSeancesTerminees}
              icon={<ClipboardCheck className="h-6 w-6 text-white" />}
              iconBg="bg-emerald-500"
              href="/prof/presences"
              hint="Historique des présences"
            />
          </div>

          {stats.groupes.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mes Groupes</h2>
                <Link
                  href="/prof/groupes"
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Voir tout <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Élèves</th>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Séances</th>
                      <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prix/Séance</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {stats.groupes.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => router.push(`/prof/groupes?id=${g.id}`)}
                        className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400 hover:underline">{g.nom}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{g.nbEleves}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{g.nbSeances}</td>
                        <td className="px-6 py-4 font-medium">{formatCurrency(g.prixParSeance)}</td>
                        <td className="px-6 py-4 text-right">
                          <ChevronRight className="ml-auto h-4 w-4 text-gray-300 dark:text-slate-600" />
                        </td>
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
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prochaines Séances</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/prof/seances"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/prof/seances?creer=1"
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Nouvelle
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Nb Présences</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {seances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucune séance à venir
                  </td>
                </tr>
              ) : (
                seances.map((seance) => (
                  <tr
                    key={seance.id}
                    onClick={() => router.push(`/prof/presences/${seance.id}`)}
                    className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  >
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(seance.date)}</td>
                    <td className="px-6 py-4 font-medium">{seance.groupe.nom}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(
                          seance.statut
                        )}`}
                      >
                        {statusLabel(seance.statut)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{seance._count.presences}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/prof/presences/${seance.id}`);
                        }}
                        className="flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        {seance.statut === "terminee" ? "Voir présences" : "Prendre présences"}
                      </button>
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
