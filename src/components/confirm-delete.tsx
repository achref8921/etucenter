"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface ConfirmDeleteProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDelete({ open, title, message, onConfirm, onCancel, loading }: ConfirmDeleteProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!open) return;
    setCountdown(5);
  }, [open]);

  useEffect(() => {
    if (!open || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        </div>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={countdown > 0 || loading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: countdown > 0 ? "#9ca3af" : "#dc2626" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : countdown > 0 ? (
              <span>Confirmer ({countdown}s)</span>
            ) : (
              <span>Supprimer</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
