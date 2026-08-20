"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import PasswordInput from "@/components/password-input";

interface ConfirmPermanentDeleteProps {
  open: boolean;
  userName: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function ConfirmPermanentDelete({ open, userName, onConfirm, onCancel, loading, error }: ConfirmPermanentDeleteProps) {
  const [countdown, setCountdown] = useState(5);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    setCountdown(5);
    setPassword("");
  }, [open]);

  useEffect(() => {
    if (!open || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-[#181b22] border border-neutral-200 dark:border-[#2a2d35] p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Suppression définitive</h2>
        </div>

        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-[13px] text-red-700 dark:text-red-400">
            Le compte de <span className="font-semibold">{userName}</span> sera <span className="font-semibold">supprimé définitivement</span>. Toutes ses données (inscriptions, paiements, présences, notifications) seront irrémédiablement perdues. Cette action est <span className="font-semibold">irréversible</span>.
          </p>
        </div>

        {countdown > 0 && (
          <div className="mb-4 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Veuillez patienter <span className="font-semibold text-neutral-700 dark:text-neutral-200">{countdown}s</span> avant de continuer...
            </p>
          </div>
        )}

        {countdown <= 0 && (
          <div className="mb-4">
            <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
              Entrez votre mot de passe pour confirmer
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128] disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(password)}
            disabled={countdown > 0 || !password.trim() || loading}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : countdown > 0 ? (
              <span>Supprimer ({countdown}s)</span>
            ) : (
              <span>Supprimer définitivement</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
