"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  Server,
  Database,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  ShieldAlert,
  Save,
  Loader2,
  Gauge,
  HardDrive,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

type MonitorLevel = "ok" | "warning" | "error";
type MonitorType = "server" | "database" | "resources";

interface CheckRow {
  id: string;
  type: MonitorType;
  status: MonitorLevel;
  responseTimeMs: number | null;
  details: any;
  checkedAt: string;
}

interface Summary {
  latest: Record<MonitorType, CheckRow | null>;
  uptime24h: number | null;
  checksToday: number;
  errorsToday: number;
  alerts24h: number;
  history: CheckRow[];
}

interface SettingsMap {
  monitorEnabled?: string;
  monitorIntervalMinutes?: string;
  alertEmails?: string;
  alertWebhookUrl?: string;
}

const statusMeta: Record<MonitorLevel, { label: string; pill: string; dot: string }> = {
  ok: {
    label: "OK",
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  warning: {
    label: "Avertissement",
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  error: {
    label: "Erreur",
    pill: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    dot: "bg-red-500",
  },
};

const typeMeta: Record<MonitorType, { label: string; icon: any; cls: string }> = {
  server: { label: "Serveur", icon: Server, cls: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  database: { label: "Base de données", icon: Database, cls: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
  resources: { label: "Ressources", icon: Cpu, cls: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function MonitoringPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [monRes, setRes] = await Promise.all([
        fetch("/api/super-admin/monitor"),
        fetch("/api/super-admin/settings"),
      ]);
      if (monRes.ok) {
        const data = await monRes.json();
        setSummary(data.summary);
      }
      if (setRes.ok) {
        const data = await setRes.json();
        const s = data.settings || {};
        setSettings({
          monitorEnabled: s.monitorEnabled ?? "true",
          monitorIntervalMinutes: s.monitorIntervalMinutes ?? "5",
          alertEmails: s.alertEmails ?? "",
          alertWebhookUrl: s.alertWebhookUrl ?? "",
        });
      }
      setError("");
    } catch {
      setError("Impossible de charger le monitoring");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function runCheckNow() {
    setRunning(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/super-admin/monitor/status");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de la vérification");
      } else {
        const failures = (data.results || []).filter((r: any) => r.status === "error");
        setSuccess(
          data.alertSent
            ? "Incident détecté : alerte envoyée"
            : failures.length > 0
              ? "Incident détecté (alerte déjà envoyée récemment)"
              : "Vérification effectuée : tout est opérationnel"
        );
        await loadData();
      }
    } catch {
      setError("Erreur lors de la vérification");
    }
    setRunning(false);
  }

  async function saveConfig() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monitorEnabled: settings.monitorEnabled,
          monitorIntervalMinutes: settings.monitorIntervalMinutes,
          alertEmails: settings.alertEmails,
          alertWebhookUrl: settings.alertWebhookUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de l'enregistrement");
      } else {
        setSuccess("Réglages de monitoring enregistrés");
        setSettings(data.settings || settings);
      }
    } catch {
      setError("Erreur lors de l'enregistrement");
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-400 dark:text-slate-500">Chargement du monitoring...</div>;
  }

  const latest = (summary?.latest ?? {}) as Record<MonitorType, CheckRow | null>;
  const history = summary?.history ?? [];
  const memData = history.filter((c) => c.type === "resources").map((c) => ({
    t: formatDate(c.checkedAt),
    RSS: c.details?.rssMB ?? 0,
    Heap: c.details?.heapUsedMB ?? 0,
  }));
  const latencyData = history.filter((c) => c.type === "database").map((c) => ({
    t: formatDate(c.checkedAt),
    ms: c.responseTimeMs ?? 0,
  }));

  const statCards = [
    {
      label: "Uptime 24h",
      value: summary?.uptime24h !== null ? `${summary?.uptime24h}%` : "—",
      icon: Gauge,
      cls: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
      sub: "Taux de disponibilité (24h)",
    },
    {
      label: "Contrôles aujourd'hui",
      value: String(summary?.checksToday ?? 0),
      icon: Activity,
      cls: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      sub: "Cycles de contrôle effectués",
    },
    {
      label: "Erreurs aujourd'hui",
      value: String(summary?.errorsToday ?? 0),
      icon: AlertTriangle,
      cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      sub: "Erreurs enregistrées",
    },
    {
      label: "Alertes 24h",
      value: String(summary?.alerts24h ?? 0),
      icon: BellRing,
      cls: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      sub: "Notifications envoyées",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Monitoring</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Santé du serveur, de la base de données et des ressources — alertes automatiques en cas d&apos;incident
          </p>
        </div>
        <button
          onClick={runCheckNow}
          disabled={running}
          className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {running ? "Vérification..." : "Vérifier maintenant"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">{success}</div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.cls}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Current status of each scope */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(Object.keys(typeMeta) as MonitorType[]).map((type) => {
          const check = latest[type];
          const meta = typeMeta[type];
          const status = check?.status ?? "error";
          const sm = statusMeta[status];
          const Icon = meta.icon;
          return (
            <div key={type} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.cls}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{meta.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {check ? formatDate(check.checkedAt) : "jamais contrôlé"}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${sm.pill}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                  {sm.label}
                </span>
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                {type === "server" && (
                  <>
                    <Row k="Temps d'activité" v={check ? formatUptime(check.details?.uptimeSec ?? 0) : "—"} />
                    <Row k="Région" v={check?.details?.region ?? "—"} />
                    <Row k="Node.js" v={check?.details?.nodeVersion ?? "—"} />
                    <Row k="Réponse" v={check?.responseTimeMs != null ? `${check.responseTimeMs} ms` : "—"} />
                  </>
                )}
                {type === "database" && (
                  <>
                    <Row k="Connexion" v={check?.details?.connected ? "Active" : "Échec"} />
                    <Row k="Version" v={check?.details?.version ?? "—"} />
                    <Row k="Temps de réponse" v={check?.responseTimeMs != null ? `${check.responseTimeMs} ms` : "—"} />
                    {check?.details?.error && <Row k="Erreur" v={String(check.details.error)} danger />}
                  </>
                )}
                {type === "resources" && (
                  <>
                    <Row k="Mémoire (RSS)" v={check ? `${check.details?.rssMB ?? 0} Mo` : "—"} />
                    <Row k="Mémoire (Heap)" v={check ? `${check.details?.heapUsedMB ?? 0} Mo` : "—"} />
                    <Row k="CPU moyen" v={check ? `${check.details?.cpuPercent ?? 0} %` : "—"} />
                    <Row k="Charge système" v={check?.details?.loadavg?.[0] != null ? String(check.details.loadavg[0]) : "—"} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <HardDrive className="h-4 w-4" /> Mémoire (derniers contrôles)
          </h2>
          {memData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={memData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip />
                <Area type="monotone" dataKey="RSS" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="Heap" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Pas encore assez de données</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Zap className="h-4 w-4" /> Temps de réponse base de données
          </h2>
          {latencyData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip />
                <Line type="monotone" dataKey="ms" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Pas encore assez de données</p>
          )}
        </div>
      </div>

      {/* Recent checks table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contrôles récents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Heure</th>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Composant</th>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Statut</th>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Réponse</th>
                <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Détail</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 30).map((c) => {
                const sm = statusMeta[c.status];
                const meta = typeMeta[c.type];
                return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="whitespace-nowrap px-5 py-2.5 text-slate-500 dark:text-slate-400">{formatDate(c.checkedAt)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 font-medium text-slate-900 dark:text-slate-100">{meta.label}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${sm.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">
                      {c.responseTimeMs != null ? `${c.responseTimeMs} ms` : "—"}
                    </td>
                    <td className="max-w-[280px] truncate px-5 py-2.5 text-slate-500 dark:text-slate-400">
                      {c.status === "error"
                        ? String(c.details?.error ?? "ressource indisponible")
                        : c.type === "database"
                          ? String(c.details?.version ?? "")
                          : c.type === "server"
                            ? `Région: ${c.details?.region ?? "—"}`
                            : `RSS ${c.details?.rssMB ?? 0} Mo · CPU ${c.details?.cpuPercent ?? 0} %`}
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    Aucun contrôle effectué. Cliquez sur « Vérifier maintenant ».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert config */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <ShieldAlert className="h-4 w-4" /> Alertes automatiques
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Notifications envoyées par email et dans l&apos;application en cas d&apos;incident. Une alerte de rétablissement est envoyée une fois le service de retour à la normale.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
              Monitoring automatique
              <button
                onClick={() => setSettings({ ...settings, monitorEnabled: settings.monitorEnabled === "true" ? "false" : "true" })}
                className={`relative h-6 w-11 rounded-full transition-colors ${settings.monitorEnabled === "true" ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.monitorEnabled === "true" ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </label>
            <p className="text-xs text-slate-400 dark:text-slate-500">Contrôles périodiques via la tâche planifiée.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Intervalle (minutes)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={settings.monitorIntervalMinutes ?? "5"}
              onChange={(e) => setSettings({ ...settings, monitorIntervalMinutes: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Emails d&apos;alerte</label>
            <input
              type="text"
              value={settings.alertEmails ?? ""}
              onChange={(e) => setSettings({ ...settings, alertEmails: e.target.value })}
              placeholder="admin@exemple.com, autre@exemple.com"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Vide = emails des super administrateurs.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Webhook (Slack/Discord…) — optionnel</label>
            <input
              type="url"
              value={settings.alertWebhookUrl ?? ""}
              onChange={(e) => setSettings({ ...settings, alertWebhookUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer les alertes
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{k}</span>
      <span className={`truncate font-semibold ${danger ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}>
        {danger ? <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{v}</span> : v}
      </span>
    </div>
  );
}
