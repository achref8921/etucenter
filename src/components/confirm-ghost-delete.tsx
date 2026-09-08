"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Wallet, UserRound, FileText, CreditCard, TrendingDown, Bell } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { formatCurrency, cn } from "@/lib/utils";

export interface GhostImpactData {
  role: "eleve" | "prof";
  soldeNet: number;
  transactions: number;
  inscriptions: number;
  paiements: { count: number; montant: number };
  presences: number;
  gainsProf: { count: number; montant: number };
  notifications: number;
}

interface ConfirmGhostDeleteProps {
  open: boolean;
  user: { id: string; prenom: string; nom: string } | null;
  impact: GhostImpactData | null;
  onConfirm: (id: string, motDePasse: string) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function ConfirmGhostDelete({
  open,
  user,
  impact,
  onConfirm,
  onCancel,
  loading,
  error,
}: ConfirmGhostDeleteProps) {
  const [password, setPassword] = useState("");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setCountdown(5);
  }, [open]);

  useEffect(() => {
    if (!open || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  if (!open || !user || !impact) return null;

  const money = (value: number) => formatCurrency(value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-[#181b22] border border-neutral-200 dark:border-[#2a2d35] shadow-xl">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Effacer le compte supprimé</h2>
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-700 dark:text-neutral-200">{user.prenom} {user.nom}</span> — action irréversible, toutes les données seront effacées
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <Wallet className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className={`text-lg font-bold ${impact.soldeNet < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>{money(impact.soldeNet)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Solde</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <CreditCard className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{impact.transactions}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Opérations</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <FileText className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{impact.paiements.montant ? money(impact.paiements.montant) : impact.paiements.count}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Paiements ({impact.paiements.count})</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <UserRound className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{impact.inscriptions}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Inscriptions</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <FileText className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{impact.presences}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Présences</p>
            </div>
            {impact.role === "prof" ? (
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
                <TrendingDown className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{money(impact.gainsProf.montant)}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Gains ({impact.gainsProf.count})</p>
              </div>
            ) : (
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
                <Bell className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{impact.notifications}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Notifications</p>
              </div>
            )}
          </div>

          {impact.soldeNet !== 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-[13px] text-amber-800 dark:text-amber-300">
              Attention : un solde de <span className="font-semibold">{money(impact.soldeNet)}</span> est associé à ce compte. L'effacer définitivement fera perdre cette trace financière.
            </div>
          )}

          {countdown > 0 && (
            <div className="text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Veuillez patienter <span className="font-semibold text-neutral-700 dark:text-neutral-200">{countdown}s</span> avant de continuer...
              </p>
            </div>
          )}

          {countdown <= 0 && (
            <div>
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
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 dark:border-[#2a2d35] px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128] disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(user.id, password)}
            disabled={countdown > 0 || !password.trim() || loading}
            className={cn(
              "flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : countdown > 0 ? `Effacer (${countdown}s)` : "Effacer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}