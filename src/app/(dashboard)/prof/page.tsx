"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ClipboardCheck,
  FolderOpen,
  Users,
  TrendingUp,
  ChevronRight,
  ClipboardList,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { SkeletonPage } from "@/components/ui/skeleton";

interface GroupeStats {
  id: string;
  nom: string;
  prixParSeance: number;
  nbEleves: number;
  nbSeances: number;
}

interface Stats {
  tauxPourcentage: number;
  impayeNet: number;
  claimable: number;
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
  if (s === "planifiee") return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";
  if (s === "en_cours") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  if (s === "terminee") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
  return "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400";
};

const statusLabel = (s: string) => {
  if (s === "planifiee") return "Planifiee";
  if (s === "en_cours") return "En cours";
  if (s === "terminee") return "Terminee";
  return "Annulee";
};

export default function ProfDashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

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
    return <SkeletonPage />;
  }

  const sessionTiming = (s: Seance): { label: string; live: boolean } | null => {
    const start = new Date(s.date);
    if (s.statut === "annulee") return null;
    if (s.statut === "en_cours") return { label: "En cours", live: true };
    if (start <= now) {
      const end = s.heureFin ? new Date(s.heureFin) : null;
      if (end && now < end) return { label: "En cours", live: true };
      return null;
    }
    const diff = start.getTime() - now.getTime();
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return { label: "Imminent", live: true };
    if (mins < 60) return { label: `Dans ${mins} min`, live: false };
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { label: m === 0 ? `Dans ${h}h` : `Dans ${h}h ${m.toString().padStart(2, "0")}`, live: false };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Bonjour, {user?.prenom ?? "Prof"}
        </h1>
        <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
          Vue d&apos;ensemble de votre activite.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-3 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* Hero card + secondary stats */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Hero card - Impaye Total */}
            <Link
              href="/prof/eleves?filter=unpaid"
              className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/50 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-100 dark:border-[#2a2d35] dark:from-indigo-500/5 dark:via-[#181b22] dark:to-indigo-500/5 dark:hover:shadow-indigo-500/5"
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-100/50 dark:bg-indigo-500/5" />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Impaye Total (net {stats.tauxPourcentage}%)
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
                  {formatCurrency(stats.impayeNet)}
                </p>
                <div className="mt-3 flex items-center gap-1 text-[12px] font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                  Voir les details <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </Link>

            {/* Encaisser */}
            <Link
              href="/prof/compte"
              className="group rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#2a2d35] dark:bg-[#181b22]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    A Encaisser (net {stats.tauxPourcentage}%)
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(stats.claimable)}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-500/10">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[12px] font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                Ce que le centre vous doit <ChevronRight className="h-3 w-3" />
              </div>
            </Link>

            {/* Eleves */}
            <Link
              href="/prof/eleves"
              className="group rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-[#2a2d35] dark:bg-[#181b22]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Mes Eleves
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
                    {stats.totalEleves}
                  </p>
                </div>
                <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-500/10">
                  <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[12px] font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                Voir la liste <ChevronRight className="h-3 w-3" />
              </div>
            </Link>
          </div>

          {/* Compact stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/prof/seances"
              className="group rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-all duration-200 hover:border-indigo-200 hover:shadow-sm dark:border-[#2a2d35] dark:bg-[#181b22] dark:hover:border-indigo-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-50 p-1.5 dark:bg-blue-500/10">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{stats.totalSeances}</p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Seances</p>
                </div>
              </div>
            </Link>
            <Link
              href="/prof/groupes"
              className="group rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-all duration-200 hover:border-indigo-200 hover:shadow-sm dark:border-[#2a2d35] dark:bg-[#181b22] dark:hover:border-indigo-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-violet-50 p-1.5 dark:bg-violet-500/10">
                  <FolderOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{stats.groupes.length}</p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Groupes</p>
                </div>
              </div>
            </Link>
            <Link
              href="/prof/presences"
              className="group rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-all duration-200 hover:border-indigo-200 hover:shadow-sm dark:border-[#2a2d35] dark:bg-[#181b22] dark:hover:border-indigo-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-emerald-50 p-1.5 dark:bg-emerald-500/10">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{stats.totalSeancesTerminees}</p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Presences</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Mes Groupes table */}
          {stats.groupes.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]">
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-[#2a2d35]">
                <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Mes Groupes</h2>
                <Link
                  href="/prof/groupes"
                  className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Voir tout
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-[#2a2d35]">
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Eleves</th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Seances</th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Prix/Seance</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
                    {stats.groupes.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => router.push(`/prof/groupes?id=${g.id}`)}
                        className="cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                      >
                        <td className="px-5 py-3 font-medium text-indigo-600 dark:text-indigo-400">{g.nom}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[12px] font-medium text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
                            {g.nbEleves}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[12px] font-medium text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
                            {g.nbSeances}
                          </span>
                        </td>
                        <td className="px-5 py-3 tabular-nums font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(g.prixParSeance)}</td>
                        <td className="px-5 py-3">
                          <ChevronRight className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
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

      {/* Prochaines Seances */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-[#2a2d35]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Prochaines Seances</h2>
          <div className="flex items-center gap-2">
            <Link
              href="/prof/seances"
              className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Voir tout
            </Link>
            <Link
              href="/prof/seances?creer=1"
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-3 w-3" /> Nouvelle
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-[#2a2d35]">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Statut</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Presences</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {seances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Calendar className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                      <p className="text-[13px] text-neutral-400 dark:text-neutral-500">Aucune seance a venir</p>
                    </div>
                  </td>
                </tr>
              ) : (
                seances.map((seance) => {
                  const timing = sessionTiming(seance);
                  return (
                  <tr
                    key={seance.id}
                    onClick={() => router.push(`/prof/presences/${seance.id}`)}
                    className="cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  >
                    <td className="px-5 py-3 text-neutral-500 dark:text-neutral-400">{formatDate(seance.date)}</td>
                    <td className="px-5 py-3 font-medium text-neutral-900 dark:text-neutral-100">{seance.groupe.nom}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusColor(seance.statut)}`}>
                        {statusLabel(seance.statut)}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-500 dark:text-neutral-400">{seance._count.presences}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {timing && (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            timing.live
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                          }`}>
                            {timing.live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse dark:bg-emerald-400" />}
                            {timing.label}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/prof/presences/${seance.id}`);
                          }}
                          className="flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-[12px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                        >
                          <ClipboardList className="h-3 w-3" />
                          {seance.statut === "terminee" ? "Voir" : "Prendre"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
