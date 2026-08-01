"use client";

import { useEffect, useRef, useState } from "react";
import {
  Database, Plus, Download, Trash2, ShieldCheck, RotateCcw, X,
  RefreshCw, CheckCircle, AlertTriangle, HardDrive, Layers, Clock, FileJson,
} from "lucide-react";
import ConfirmDelete from "@/components/confirm-delete";

type BackupStatus = "en_cours" | "ok" | "echec" | "restaure";
type BackupType = "automatique" | "manuel";

interface SystemBackup {
  id: string;
  version: number;
  type: BackupType;
  status: BackupStatus;
  checksum: string | null;
  sizeBytes: number | null;
  rowCounts: Record<string, number> | null;
  createdBy: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  restoredAt: string | null;
}

interface BackupStats {
  total: number;
  ok: number;
  echec: number;
  enCours: number;
  last: { createdAt: string; version: number; sizeBytes: number | null } | null;
  totalSizeBytes: number;
  retention: number;
}

interface VerifyResult {
  valid: boolean;
  checksumOk: boolean;
  structuralErrors: string[];
  counts: Record<string, number>;
  sizeBytes: number;
  checksum: string | null;
}

const statusStyles: Record<BackupStatus, { label: string; cls: string }> = {
  ok: { label: "Valide", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  en_cours: { label: "En cours", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  echec: { label: "Échec", cls: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  restaure: { label: "Restauree", cls: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400" },
};

const typeLabels: Record<BackupType, string> = {
  automatique: "Automatique",
  manuel: "Manuelle",
};

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["octets", "Ko", "Mo", "Go"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function totalRecords(rowCounts: Record<string, number> | null): number {
  if (!rowCounts) return 0;
  return Object.values(rowCounts).reduce((sum, n) => sum + n, 0);
}

const tableLabels: Record<string, string> = {
  centers: "Centres",
  utilisateurs: "Utilisateurs",
  matieres: "Matieres",
  groupes: "Groupes",
  inscriptions: "Inscriptions",
  seances: "Seances",
  presences: "Presences",
  paiements: "Paiements",
  tauxBenefices: "Taux benefices",
  notifications: "Notifications",
  centerSubscriptions: "Abonnements",
};

export default function SuperAdminBackupsPage() {
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verifyTarget, setVerifyTarget] = useState<SystemBackup | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<SystemBackup | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoreConfirmChecked, setRestoreConfirmChecked] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SystemBackup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadData(showSpinner = false) {
    if (showSpinner) setLoading(true);
    const res = await fetch("/api/super-admin/backups");
    if (res.ok) {
      const data = await res.json();
      setBackups(data.backups || []);
      setStats(data.stats || null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData(true);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (backups.some((b) => b.status === "en_cours")) {
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = setTimeout(() => loadData(false), 5000);
    }
  }, [backups]);

  async function handleCreate() {
    setError("");
    setSuccess("");
    setCreating(true);
    try {
      const res = await fetch("/api/super-admin/backups", { method: "POST" });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok || !data.success) {
        setError(data.error || `Erreur lors de la création de la sauvegarde (HTTP ${res.status})`);
      } else {
        setSuccess("Sauvegarde lancée. Elle apparaîtra dans la liste dès qu'elle sera terminée.");
      }
      await loadData(false);
    } catch {
      setError("Erreur lors de la création de la sauvegarde (connexion interrompue)");
    }
    setCreating(false);
  }

  async function handleVerify(backup: SystemBackup) {
    setVerifyTarget(backup);
    setVerifyResult(null);
    setVerifying(true);
    try {
      const res = await fetch(`/api/super-admin/backups/${backup.id}/verify`, { method: "POST" });
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      setVerifyResult({
        valid: false, checksumOk: false, structuralErrors: ["Erreur lors de la vérification"], counts: {}, sizeBytes: 0, checksum: null,
      });
    }
    setVerifying(false);
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    setError("");
    setSuccess("");
    setRestoring(true);
    try {
      const res = await fetch(`/api/super-admin/backups/${restoreTarget.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la restauration");
      } else {
        const added = data.counts ? Object.entries(data.counts).filter(([, n]) => (n as number) > 0).map(([k, n]) => `${k}: ${n}`).join(", ") : "";
        const mergedCount = data.merged ? Object.values(data.merged).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 0;
        const temps = (data.tempPasswords || []).length;
        let msg = data.message || "Base de données fusionnée avec succès";
        if (mergedCount > 0 || added) msg += ` | ${mergedCount} existant(s) conservé(s)${added ? `, ajoutés → ${added}` : ""}`;
        if (temps > 0) msg += ` | ${temps} compte(s) réactivé(s) avec mot de passe temporaire (voir journal)`;
        setSuccess(msg);
        setRestoreTarget(null);
        setRestoreConfirm("");
        setRestoreConfirmChecked(false);
      }
      await loadData(false);
    } catch {
      setError("Erreur lors de la restauration");
    }
    setRestoring(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/super-admin/backups/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteTarget(null);
      await loadData(false);
    }
    setDeleting(false);
  }

  function handleDownload(backup: SystemBackup) {
    const a = document.createElement("a");
    a.href = `/api/super-admin/backups/${backup.id}/download`;
    a.download = "";
    a.click();
  }

  const statCards = [
    {
      icon: Layers,
      label: "Sauvegardes totales",
      value: stats ? String(stats.total) : "—",
      sub: stats ? `${stats.ok} valides / ${stats.echec} échecs` : "",
      cls: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
    },
    {
      icon: Clock,
      label: "Dernière sauvegarde",
      value: stats?.last ? `v${stats.last.version}` : "Aucune",
      sub: stats?.last ? formatDate(stats.last.createdAt) : "Aucune sauvegarde encore",
      cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      icon: HardDrive,
      label: "Espace utilisé",
      value: formatBytes(stats?.totalSizeBytes ?? null),
      sub: "stockage des snapshots",
      cls: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30",
    },
    {
      icon: ShieldCheck,
      label: "Rétention",
      value: stats ? `${stats.retention} versions` : "—",
      sub: "les plus anciennes sont purgées",
      cls: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sauvegardes de la base</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
            Snapshots complets de la base de données : sauvegarde automatique quotidienne, vérification d&apos;intégrité et restauration
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 hover:bg-violet-700 transition-colors disabled:opacity-50 dark:shadow-violet-900/30 dark:hover:bg-violet-500"
        >
          {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? "Création..." : "Nouvelle sauvegarde"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-3 text-xs font-semibold underline hover:text-red-900">Fermer</button>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {success}
          <button onClick={() => setSuccess("")} className="ml-3 text-xs font-semibold underline hover:text-emerald-900">Fermer</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Version</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Statut</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Taille</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Enregistrements</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Chargement...</td></tr>
              ) : backups.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  Aucune sauvegarde pour le moment. Lancez une sauvegarde manuelle ou attendez la sauvegarde automatique.
                </td></tr>
              ) : backups.map((b) => {
                const st = statusStyles[b.status];
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800">
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-xs font-bold text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                        v{b.version}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{typeLabels[b.type]}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">{formatDate(b.createdAt)}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{formatBytes(b.sizeBytes)}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{totalRecords(b.rowCounts)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleVerify(b)} title="Vérifier l'intégrité" className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-slate-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400">
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDownload(b)} title="Télécharger" className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors dark:text-slate-500 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400">
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setRestoreTarget(b); setRestoreConfirm(""); setRestoreConfirmChecked(false); }}
                          disabled={b.status !== "ok"}
                          title={b.status === "ok" ? "Restaurer cette version" : "Seules les sauvegardes valides peuvent être restaurées"}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 dark:text-slate-500 dark:hover:bg-violet-900/20 dark:hover:text-violet-400"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(b)} title="Supprimer" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Chargement...</div>
          ) : backups.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Aucune sauvegarde pour le moment.</div>
          ) : backups.map((b) => {
            const st = statusStyles[b.status];
            return (
              <div key={b.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-xs font-bold text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">v{b.version}</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{typeLabels[b.type]}</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(b.createdAt)} · {formatBytes(b.sizeBytes)} · {totalRecords(b.rowCounts)} enregistrements</p>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => handleVerify(b)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors">
                    <ShieldCheck className="h-3.5 w-3.5" /> Vérifier
                  </button>
                  <button onClick={() => handleDownload(b)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors">
                    <Download className="h-3.5 w-3.5" /> Télécharger
                  </button>
                  <button
                    onClick={() => { setRestoreTarget(b); setRestoreConfirm(""); setRestoreConfirmChecked(false); }}
                    disabled={b.status !== "ok"}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-50 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-30 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/30 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                  </button>
                  <button onClick={() => setDeleteTarget(b)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-400">
        <p>
          <strong>Fonctionnement :</strong> une sauvegarde automatique est déclenchée chaque jour à 03:17 (heure serveur). Les snapshots sont stockés dans la base et les
          {stats ? ` ${stats.retention}` : " N"} plus récents sont conservés (rétention configurable via <code>BACKUP_RETENTION</code>). Chaque snapshot est signé par une empreinte SHA-256,
          vérifiée avant toute restauration. Les lectures de sauvegarde utilisent un instantané MVCC (<code>RepeatableRead</code>) : la copie ne bloque ni les lectures ni les écritures du site.
          Pour une sécurité maximale, téléchargez régulièrement une copie hors-site via l&apos;icône de téléchargement.
        </p>
      </div>

      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Vérification — v{verifyTarget.version}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(verifyTarget.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => { setVerifyTarget(null); setVerifyResult(null); }} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {verifying ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin" /> Vérification en cours...
              </div>
            ) : verifyResult ? (
              <div className="space-y-4">
                {verifyResult.valid ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="h-5 w-5" />
                      <p className="text-sm font-semibold">Sauvegarde saine et intègre</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-5 w-5" />
                      <p className="text-sm font-semibold">Sauvegarde corrompue ou invalide</p>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400">
                      {verifyResult.structuralErrors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 dark:text-slate-400">Détails</p>
                  <div className="space-y-1 text-sm">
                    <p className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Empreinte SHA-256</span>
                      <span className={verifyResult.checksumOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {verifyResult.checksumOk ? "Conforme" : "Non conforme"}
                      </span>
                    </p>
                    <p className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Empreinte stockée</span>
                      <span className="font-mono text-xs">{verifyResult.checksum ? `${verifyResult.checksum.slice(0, 12)}…` : "—"}</span>
                    </p>
                    <p className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Taille</span>
                      <span>{formatBytes(verifyResult.sizeBytes)}</span>
                    </p>
                  </div>
                </div>

                {Object.keys(verifyResult.counts).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(verifyResult.counts).map(([key, val]) => (
                      <span key={key} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                        {tableLabels[key] || key}: <strong>{val}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Restaurer la base — v{restoreTarget.version}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(restoreTarget.createdAt)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4 dark:border-amber-800 dark:bg-amber-900/10">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Fusion :</strong> les données actuelles de toutes les bases sont conservées. Les éléments de cette sauvegarde
                (centres, utilisateurs, groupes, séances, présences, paiements, inscriptions, notifications…) qui n&apos;existent pas
                encore seront <strong>ajoutés</strong> par-dessus. Rien n&apos;est supprimé ni remplacé.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/10">
                <input
                  type="checkbox"
                  checked={restoreConfirmChecked}
                  onChange={(e) => setRestoreConfirmChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Je comprends que les données actuelles sont conservées et que les éléments manquants de la version v{restoreTarget.version} seront ajoutés
                </span>
              </label>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tapez <span className="font-mono font-bold">RESTAURER</span> pour confirmer
                </label>
                <input
                  type="text"
                  value={restoreConfirm}
                  onChange={(e) => setRestoreConfirm(e.target.value)}
                  placeholder="RESTAURER"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => { setRestoreTarget(null); setRestoreConfirm(""); setRestoreConfirmChecked(false); }} disabled={restoring} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800">
                Annuler
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring || restoreConfirm !== "RESTAURER" || !restoreConfirmChecked}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-red-500"
              >
                {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {restoring ? "Restauration en cours..." : "Restaurer maintenant"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDelete
        open={!!deleteTarget}
        title="Supprimer la sauvegarde"
        message={`Supprimer la sauvegarde v${deleteTarget?.version} ? Cette action est définitive.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
