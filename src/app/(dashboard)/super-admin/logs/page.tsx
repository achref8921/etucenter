"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, Building2, UserPlus, Settings, Shield, Trash2, Pencil, UserMinus, Loader2 } from "lucide-react";
import ConfirmDelete from "@/components/confirm-delete";

interface LogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: unknown;
  createdAt: string;
}

const actionIcons: Record<string, typeof AlertTriangle> = {
  center_created: Building2,
  center_suspended: AlertTriangle,
  center_activated: Building2,
  center_deleted: Trash2,
  center_updated: Pencil,
  admin_created: UserPlus,
  admin_reset: Settings,
  admin_deleted: UserMinus,
};

const actionColors: Record<string, string> = {
  center_created: "text-emerald-500 dark:text-emerald-400",
  center_suspended: "text-red-500 dark:text-red-400",
  center_activated: "text-blue-500 dark:text-blue-400",
  center_deleted: "text-red-500 dark:text-red-400",
  center_updated: "text-amber-500 dark:text-amber-400",
  admin_created: "text-violet-500 dark:text-violet-400",
  admin_reset: "text-amber-500 dark:text-amber-400",
  admin_deleted: "text-red-500 dark:text-red-400",
};

export default function SuperAdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  async function loadLogs() {
    setLoading(true);
    const res = await fetch("/api/super-admin/logs");
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadLogs(); }, []);

  async function deleteLog(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/super-admin/logs?id=${id}`, { method: "DELETE" });
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteAllLogs() {
    setDeletingAll(true);
    try {
      await fetch("/api/super-admin/logs", { method: "DELETE" });
      setLogs([]);
      setShowConfirmAll(false);
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Journaux système</h1>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">Historique des actions critiques de la plateforme</p>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button
                onClick={() => setShowConfirmAll(true)}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium text-neutral-600 hover:bg-red-50 hover:text-red-600 transition-colors dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Tout supprimer
              </button>
            </>
          )}
          <button onClick={loadLogs} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium text-neutral-600 hover:bg-neutral-50 transition-colors dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-400 dark:hover:bg-[#1e2128]">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden dark:border-[#2a2d35] dark:bg-[#181b22]">
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px] text-neutral-400 dark:text-neutral-500">Chargement…</div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px] text-neutral-400 dark:text-neutral-500">Aucun journal enregistré.</div>
        ) : (
          <table className="min-w-full divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Action</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Entité</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Détails</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {logs.map((log) => {
                const Icon = actionIcons[log.action] || Shield;
                const color = actionColors[log.action] || "text-neutral-400 dark:text-neutral-500";
                return (
                  <tr key={log.id} className="hover:bg-neutral-100/50 transition-colors dark:hover:bg-[#1e2128]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
                        <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">{log.action.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-500 dark:text-neutral-400">{log.entity || "—"}</td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-500 max-w-xs truncate dark:text-neutral-400">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                      {new Date(log.createdAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => deleteLog(log.id)}
                        disabled={deletingId === log.id}
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Supprimer"
                      >
                        {deletingId === log.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDelete
        open={showConfirmAll}
        title="Supprimer tous les logs"
        message="Êtes-vous sûr de vouloir supprimer tous les logs système ? Cette action est irréversible."
        onConfirm={deleteAllLogs}
        onCancel={() => setShowConfirmAll(false)}
        loading={deletingAll}
      />
    </div>
  );
}
