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
  center_created: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  center_suspended: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  center_activated: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  center_deleted: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  center_updated: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  admin_created: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  admin_reset: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  admin_deleted: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">System Logs</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Audit trail of critical platform actions</p>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button
                onClick={() => setShowConfirmAll(true)}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-800 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
                Tout supprimer
              </button>
            </>
          )}
          <button onClick={loadLogs} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500">No system logs recorded yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Entity</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Details</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {logs.map((log) => {
                const Icon = actionIcons[log.action] || Shield;
                const color = actionColors[log.action] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{log.action.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{log.entity || "—"}</td>
                    <td className="px-5 py-3 text-sm text-slate-500 max-w-xs truncate dark:text-slate-400">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(log.createdAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => deleteLog(log.id)}
                        disabled={deletingId === log.id}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
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
