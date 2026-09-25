"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Clock,
  Download,
  Loader2,
  MousePointerClick,
  Search,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  FeatureUsageChart,
  RoleShareChart,
  UsageActivityChart,
} from "@/components/charts/analytics-charts";

interface Overview {
  activeUsersToday: number;
  activeUsers7d: number;
  activeUsers30d: number;
  activeUsersPrevious: number;
  totalSessions: number;
  averageSessionDurationSeconds: number;
  totalEvents: number;
  totalUsers: number;
  dauMauRatio: number;
}

interface UsageData {
  range: { from: string; to: string };
  overview: Overview;
  deltas: { events: number; sessions: number; activeUsers: number };
  daily: Array<{ day: string; users: number; events: number }>;
  features: Array<{ feature: string; count: number; uniqueUsers: number; percentage: number }>;
  pages: Array<{ path: string; count: number; uniqueUsers: number; percentage: number }>;
  roles: Array<{
    role: string;
    sessions: number;
    events: number;
    uniqueUsers: number;
    averageDurationSeconds: number;
  }>;
  centers: Array<{
    centerId: string;
    centerName: string;
    users: number;
    events: number;
    sessions: number;
  }>;
  byEvent: Array<{ event: string; count: number }>;
  insights: {
    mostUsedFeature: { feature: string; count: number } | null;
    leastUsedFeature: { feature: string; count: number } | null;
    averageSessionDurationSeconds: number;
    activeUserRate: number;
    topRole: string | null;
    busiestDay: { day: string; users: number; events: number } | null;
  };
}

interface UserRow {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  lastSeenAt: string | null;
  centerId: string;
  centerName: string;
  sessions: number;
  activeDays: number;
  totalUsageSeconds: number;
  topFeature: string | null;
}

interface UserDetail {
  user: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: string;
    lastSeenAt: string | null;
    centerName: string;
  };
  stats: {
    sessions: number;
    totalSessions: number;
    totalUsageSeconds: number;
    averageSessionDurationSeconds: number;
    activeDays: number;
  };
  topFeatures: Array<{ feature: string; count: number }>;
  topPages: Array<{ path: string; count: number }>;
  journey: string[];
  recentActivity: Array<{
    id: string;
    event: string;
    path: string | null;
    feature: string | null;
    createdAt: string;
  }>;
  sessionHistory: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    endReason: string | null;
  }>;
}

const RANGES = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "3m", label: "3 mois" },
  { value: "custom", label: "Personnalisé" },
];

const ROLES = [
  { value: "", label: "Tous les rôles" },
  { value: "admin", label: "Admin" },
  { value: "prof", label: "Enseignant" },
  { value: "eleve", label: "Élève" },
  { value: "super_admin", label: "Super Admin" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  prof: "Enseignant",
  eleve: "Élève",
  super_admin: "Super Admin",
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0 min";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-TN");
}

function DeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) {
    return <span className="text-[11px] text-neutral-400">stable</span>;
  }
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-[#1e2128] dark:bg-[#141720]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
              {sub}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-lg bg-violet-50 p-2 dark:bg-violet-500/10">
            <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          {typeof delta === "number" && <DeltaBadge value={delta} />}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminUsagePage() {
  const [range, setRange] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [centerId, setCenterId] = useState("");
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const rangeQuery =
    range === "custom" && customFrom && customTo
      ? `range=custom&from=${customFrom}&to=${customTo}`
      : `range=${range}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(rangeQuery);
      if (centerId) params.set("centerId", centerId);
      const res = await fetch(`/api/super-admin/usage?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Erreur de chargement");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Impossible de charger les données d'usage");
    } finally {
      setLoading(false);
    }
  }, [rangeQuery, centerId]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams(rangeQuery);
      params.set("page", String(usersPage));
      params.set("pageSize", "25");
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (activeFilter) params.set("active", activeFilter);
      if (centerId) params.set("centerId", centerId);
      const res = await fetch(`/api/super-admin/usage/users?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setUsers(json.users ?? []);
        setUsersTotal(json.total ?? 0);
        setUsersTotalPages(json.totalPages ?? 1);
      }
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [rangeQuery, usersPage, search, roleFilter, activeFilter, centerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setUsersPage(1);
  }, [search, roleFilter, activeFilter, centerId, range]);

  async function openUser(id: string) {
    setDetailLoading(true);
    setSelectedUser(null);
    try {
      const res = await fetch(`/api/super-admin/usage/user/${id}?${rangeQuery}`);
      if (res.ok) setSelectedUser(await res.json());
    } catch {
      setSelectedUser(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function exportCsv() {
    if (users.length === 0) return;
    const header = [
      "Nom",
      "Prenom",
      "Email",
      "Role",
      "Centre",
      "Sessions",
      "Jours actifs",
      "Temps total (min)",
      "Derniere activite",
      "Feature principale",
    ];
    const lines = users.map((u) =>
      [
        u.nom,
        u.prenom,
        u.email,
        ROLE_LABELS[u.role] ?? u.role,
        u.centerName,
        u.sessions,
        u.activeDays,
        Math.round(u.totalUsageSeconds / 60),
        u.lastSeenAt ?? "jamais",
        u.topFeature ?? "",
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
        {error ?? "Impossible de charger les données d'usage."}
      </div>
    );
  }

  const o = data.overview;
  const featureChartData = data.features.slice(0, 8).map((f) => ({
    name: f.feature,
    value: f.count,
  }));
  const roleChartData = data.roles
    .filter((r) => r.events > 0)
    .map((r) => ({ name: ROLE_LABELS[r.role] ?? r.role, value: r.events }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Analyse d&apos;usage
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
            Comportement réel des utilisateurs sur la plateforme
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={users.length === 0}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-[#1e2128] dark:bg-[#141720] dark:text-neutral-200"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-[#1e2128] dark:bg-[#141720]">
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                range === r.value
                  ? "bg-violet-600 text-white"
                  : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 dark:border-[#1e2128] dark:bg-[#0f1114] dark:text-neutral-200"
            />
            <span className="text-[12px] text-neutral-400">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 dark:border-[#1e2128] dark:bg-[#0f1114] dark:text-neutral-200"
            />
          </div>
        )}

        {data.centers.length > 1 && (
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-700 dark:border-[#1e2128] dark:bg-[#0f1114] dark:text-neutral-200"
          >
            <option value="">Tous les centres</option>
            {data.centers.map((c) => (
              <option key={c.centerId} value={c.centerId}>
                {c.centerName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Utilisateurs aujourd'hui"
          value={o.activeUsersToday.toLocaleString("fr-TN")}
          sub={`${o.activeUsers7d.toLocaleString("fr-TN")} sur 7 j · ${o.activeUsers30d.toLocaleString("fr-TN")} sur 30 j`}
          icon={Users}
        />
        <KpiCard
          label="Sessions"
          value={o.totalSessions.toLocaleString("fr-TN")}
          icon={Activity}
          delta={data.deltas.sessions}
        />
        <KpiCard
          label="Durée moyenne"
          value={formatDuration(o.averageSessionDurationSeconds)}
          sub="par session"
          icon={Clock}
        />
        <KpiCard
          label="Événements"
          value={o.totalEvents.toLocaleString("fr-TN")}
          sub={`${o.totalUsers.toLocaleString("fr-TN")} comptes au total`}
          icon={MousePointerClick}
          delta={data.deltas.events}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2 dark:border-[#1e2128] dark:bg-[#141720]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Activité quotidienne
          </h2>
          <p className="mb-3 text-[11px] text-neutral-500 dark:text-neutral-400">
            Utilisateurs uniques et événements par jour
          </p>
          <UsageActivityChart data={data.daily} />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-[#1e2128] dark:bg-[#141720]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Engagement
          </h2>
          <div className="mt-3 space-y-3">
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">DAU / MAU</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {o.dauMauRatio.toFixed(0)}%
              </p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Taux d&apos;actif (30 j)
              </p>
              <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {data.insights.activeUserRate.toFixed(0)}%
              </p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Feature la plus utilisée
              </p>
              <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                {data.insights.mostUsedFeature?.feature ?? "—"}
              </p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Feature la moins utilisée
              </p>
              <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                {data.insights.leastUsedFeature?.feature ?? "—"}
              </p>
            </div>
            {data.insights.busiestDay && (
              <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Jour le plus actif
                </p>
                <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                  {data.insights.busiestDay.day} ·{" "}
                  {data.insights.busiestDay.events.toLocaleString("fr-TN")} évé.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-[#1e2128] dark:bg-[#141720]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Fonctionnalités les plus utilisées
          </h2>
          <p className="mb-3 text-[11px] text-neutral-500 dark:text-neutral-400">
            Nombre d&apos;événements par feature
          </p>
          <FeatureUsageChart data={featureChartData} />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-[#1e2128] dark:bg-[#141720]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Usage par rôle
          </h2>
          <p className="mb-3 text-[11px] text-neutral-500 dark:text-neutral-400">
            Répartition des événements
          </p>
          <RoleShareChart data={roleChartData} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-[#1e2128] dark:bg-[#141720]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Pages les plus visitées
          </h2>
          <div className="mt-3 space-y-2">
            {data.pages.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-neutral-400">Aucune donnée</p>
            ) : (
              data.pages.map((p) => (
                <div key={p.path} className="flex items-center gap-3">
                  <span
                    className="w-10 shrink-0 text-right text-[11px] font-semibold text-neutral-500 dark:text-neutral-400"
                  >
                    {p.percentage.toFixed(0)}%
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.max(2, p.percentage)}%` }}
                    />
                  </div>
                  <span
                    className="min-w-0 flex-1 truncate text-[12px] text-neutral-700 dark:text-neutral-300"
                    title={p.path}
                  >
                    {p.path}
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {p.count.toLocaleString("fr-TN")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-[#1e2128] dark:bg-[#141720]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Usage par centre
          </h2>
          <div className="mt-3 space-y-2">
            {data.centers.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-neutral-400">Aucune donnée</p>
            ) : (
              data.centers.slice(0, 10).map((c) => (
                <div
                  key={c.centerId}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 dark:border-neutral-800"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="truncate text-[12px] font-medium text-neutral-800 dark:text-neutral-200">
                      {c.centerName}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>{c.users} util.</span>
                    <span>{c.sessions} sess.</span>
                    <span>{c.events.toLocaleString("fr-TN")} évé.</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-[#1e2128] dark:bg-[#141720]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Utilisateurs ({usersTotal.toLocaleString("fr-TN")})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, prénom, email…"
                className="w-48 rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-2.5 text-[12px] text-neutral-700 dark:border-[#1e2128] dark:bg-[#0f1114] dark:text-neutral-200"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 dark:border-[#1e2128] dark:bg-[#0f1114] dark:text-neutral-200"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 dark:border-[#1e2128] dark:bg-[#0f1114] dark:text-neutral-200"
            >
              <option value="">Tous</option>
              <option value="active">Actifs sur la période</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500 dark:border-[#1e2128] dark:text-neutral-400">
                <th className="py-2 pr-3 font-medium">Utilisateur</th>
                <th className="py-2 pr-3 font-medium">Rôle</th>
                <th className="py-2 pr-3 font-medium">Centre</th>
                <th className="py-2 pr-3 font-medium">Sessions</th>
                <th className="py-2 pr-3 font-medium">Jours actifs</th>
                <th className="py-2 pr-3 font-medium">Temps total</th>
                <th className="py-2 pr-3 font-medium">Dernière activité</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-violet-600" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[13px] text-neutral-500 dark:text-neutral-400"
                  >
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-neutral-100 text-[12px] text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">
                        {u.prenom} {u.nom}
                      </div>
                      <div className="text-[11px] text-neutral-400">{u.email}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate py-2.5 pr-3">{u.centerName}</td>
                    <td className="py-2.5 pr-3">{u.sessions}</td>
                    <td className="py-2.5 pr-3">{u.activeDays}</td>
                    <td className="py-2.5 pr-3">{formatDuration(u.totalUsageSeconds)}</td>
                    <td className="py-2.5 pr-3">{formatRelative(u.lastSeenAt)}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => openUser(u.id)}
                        className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {usersTotalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Page {usersPage} sur {usersTotalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                disabled={usersPage <= 1}
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[12px] disabled:opacity-40 dark:border-[#1e2128]"
              >
                Précédent
              </button>
              <button
                onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                disabled={usersPage >= usersTotalPages}
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[12px] disabled:opacity-40 dark:border-[#1e2128]"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-[#141720]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedUser.user.prenom} {selectedUser.user.nom}
                </h3>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  {selectedUser.user.email} · {ROLE_LABELS[selectedUser.user.role] ??
                    selectedUser.user.role}{" "}
                  · {selectedUser.user.centerName}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800/50">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Sessions</p>
                <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedUser.stats.sessions}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800/50">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Jours actifs</p>
                <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedUser.stats.activeDays}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800/50">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Durée moy.
                </p>
                <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {formatDuration(selectedUser.stats.averageSessionDurationSeconds)}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800/50">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Total</p>
                <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {formatDuration(selectedUser.stats.totalUsageSeconds)}
                </p>
              </div>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-[12px] font-semibold text-neutral-900 dark:text-neutral-100">
                  Ses fonctionnalités
                </h4>
                <div className="space-y-1.5">
                  {selectedUser.topFeatures.length === 0 ? (
                    <p className="text-[12px] text-neutral-400">Aucune donnée</p>
                  ) : (
                    selectedUser.topFeatures.map((f) => (
                      <div key={f.feature} className="flex items-center justify-between text-[12px]">
                        <span className="truncate text-neutral-700 dark:text-neutral-300">
                          {f.feature}
                        </span>
                        <span className="shrink-0 text-neutral-400">{f.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-[12px] font-semibold text-neutral-900 dark:text-neutral-100">
                  Parcours
                </h4>
                <div className="flex flex-wrap gap-1">
                  {selectedUser.journey.length === 0 ? (
                    <p className="text-[12px] text-neutral-400">Aucune navigation</p>
                  ) : (
                    selectedUser.journey.map((p, i) => (
                      <span
                        key={`${p}-${i}`}
                        className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                      >
                        {p}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <h4 className="mb-2 text-[12px] font-semibold text-neutral-900 dark:text-neutral-100">
              Activité récente
            </h4>
            <div className="space-y-1">
              {selectedUser.recentActivity.length === 0 ? (
                <p className="text-[12px] text-neutral-400">Aucun événement</p>
              ) : (
                selectedUser.recentActivity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] odd:bg-neutral-50 dark:odd:bg-neutral-800/40"
                  >
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {a.event.replace(/_/g, " ")}
                    </span>
                    <span className="truncate text-[11px] text-neutral-400">{a.path ?? "—"}</span>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {formatRelative(a.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}
