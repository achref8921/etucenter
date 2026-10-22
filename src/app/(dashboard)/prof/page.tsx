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
import { MetricCard } from "@/components/ui";

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
  profit: { total: number; studentShare: number; reverseNet: number; adjustments: number };
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
  if (s === "planifiee") return "bg-blue-50 text-blue-800 dark:bg-blue-600/10 dark:text-blue-400";
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

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const monthLabel = () => {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
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
            .slice(0, 5)
            .reverse();
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
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Bonjour, {user?.prenom ?? "Prof"}
        </h1>
        <p className="text-[13px] text-[var(--foreground-faint)]">
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
          {/* KPI cards */}
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-fade-in-up"
            style={{ animationDelay: "60ms" }}
          >
            <MetricCard
              label="Impayé net"
              value={stats.impayeNet}
              sub="à recouvrer"
              icon={AlertTriangle}
              tone="error"
            />
            <MetricCard
              label="À encaisser net"
              value={stats.claimable}
              sub="dû par le centre"
              icon={TrendingUp}
              tone="primary"
            />
            <MetricCard
              label="Profit net · ce mois"
              value={stats.profit.total}
              sub={`${formatCurrency(stats.profit.studentShare)} gains élèves`}
              icon={ClipboardCheck}
              tone="success"
            />
            <MetricCard
              label="Mes élèves"
              value={stats.totalEleves}
              currency={false}
              sub={`${stats.groupes.length} groupe${stats.groupes.length > 1 ? "s" : ""}`}
              icon={Users}
              tone="warning"
            />
          </div>

          {/* Profit net du mois */}
          <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 p-6 dark:border-emerald-800/40 dark:from-emerald-500/5 dark:via-[#181b22] dark:to-emerald-500/5">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-100/50 dark:bg-emerald-500/5" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Profit net · {monthLabel()}
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(stats.profit.total)}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--foreground-faint)]">
                  <span>
                    Gains élèves :{" "}
                    <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(stats.profit.studentShare)}</b>
                  </span>
                  <span>
                    Encaissements directs :{" "}
                    <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(stats.profit.reverseNet)}</b>
                  </span>
                  <span>
                    Ajustements :{" "}
                    <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(stats.profit.adjustments)}</b>
                  </span>
                </div>
              </div>
              <Link
                href="/prof/compte"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Voir le detail <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Compact stats row */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
            <Link
              href="/prof/seances"
              className="group rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-600/20 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-50 p-1.5 dark:bg-blue-500/10">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{stats.totalSeances}</p>
                  <p className="text-[11px] text-[var(--foreground-faint)]">Seances</p>
                </div>
              </div>
            </Link>
            <Link
              href="/prof/groupes"
              className="group rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-600/20 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-50 p-1.5 dark:bg-blue-500/10">
                  <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{stats.groupes.length}</p>
                  <p className="text-[11px] text-[var(--foreground-faint)]">Groupes</p>
                </div>
              </div>
            </Link>
            <Link
              href="/prof/presences"
              className="group rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-600/20 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-emerald-50 p-1.5 dark:bg-emerald-500/10">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-50">{stats.totalSeancesTerminees}</p>
                  <p className="text-[11px] text-[var(--foreground-faint)]">Presences</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Mes Groupes table */}
          {stats.groupes.length > 0 && (
            <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Mes Groupes</h2>
                <Link
                  href="/prof/groupes"
                  className="text-[12px] font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Voir tout
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Groupe</th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Eleves</th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Seances</th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Prix/Seance</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {stats.groupes.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => router.push(`/prof/groupes?id=${g.id}`)}
                        className="cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                      >
                        <td className="px-5 py-3 font-medium text-blue-700 dark:text-blue-400">{g.nom}</td>
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
                        <td className="px-5 py-3 tabular-nums font-medium text-[var(--foreground)]">{formatCurrency(g.prixParSeance)}</td>
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
      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Prochaines Seances</h2>
          <div className="flex items-center gap-2">
            <Link
              href="/prof/seances"
              className="text-[12px] font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Voir tout
            </Link>
            <Link
              href="/prof/seances?creer=1"
              className="flex items-center gap-1 rounded-md bg-blue-700 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-blue-800"
            >
              <Plus className="h-3 w-3" /> Nouvelle
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Date</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Groupe</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Statut</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Presences</th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {seances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Calendar className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                      <p className="text-[13px] text-[var(--foreground-faint)]">Aucune seance a venir</p>
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
                    <td className="px-5 py-3 text-[var(--foreground-faint)]">{formatDate(seance.date)}</td>
                    <td className="px-5 py-3 font-medium text-[var(--foreground)]">{seance.groupe.nom}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusColor(seance.statut)}`}>
                        {statusLabel(seance.statut)}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-[var(--foreground-faint)]">{seance._count.presences}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {timing && (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            timing.live
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-blue-50 text-blue-800 dark:bg-blue-600/10 dark:text-blue-400"
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
