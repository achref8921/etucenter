"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, CalendarClock, Wallet, TrendingDown, BadgeEuro, UserRound, Trash2, Eraser } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { formatCurrency, cn } from "@/lib/utils";

export interface GroupeDeleteImpact {
  seances: number;
  presences: number;
  consommations: { count: number; montant: number };
  paiements: { count: number; montant: number };
  gainsProf: { count: number; montant: number };
}

interface ConfirmGroupeDeleteProps {
  open: boolean;
  groupe: { id: string; nom: string } | null;
  impact: GroupeDeleteImpact | null;
  onConfirm: (mode: "only" | "full", motDePasse: string) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function ConfirmGroupeDelete({
  open,
  groupe,
  impact,
  onConfirm,
  onCancel,
  loading,
  error,
}: ConfirmGroupeDeleteProps) {
  const [mode, setMode] = useState<"full" | "only">("full");
  const [password, setPassword] = useState("");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!open) return;
    setMode("full");
    setPassword("");
    setCountdown(5);
  }, [open]);

  useEffect(() => {
    if (!open || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  if (!open || !groupe || !impact) return null;

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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Supprimer le groupe</h2>
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-700 dark:text-neutral-200">{groupe.nom}</span> — action irréversible
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <CalendarClock className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{impact.seances}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Séances</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <UserRound className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{impact.presences}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Présences</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <Wallet className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{money(impact.consommations.montant)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Consommé ({impact.consommations.count} op.)</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <BadgeEuro className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{money(impact.paiements.montant)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Paiements ({impact.paiements.count})</p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-2.5 text-center">
              <TrendingDown className="mx-auto mb-1 h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{money(impact.gainsProf.montant)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Gains prof ({impact.gainsProf.count})</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                mode === "full"
                  ? "border-red-500 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                  : "border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
              )}
            >
              <div className={cn("mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2",
                mode === "full" ? "border-red-600" : "border-neutral-300 dark:border-neutral-600")}>
                {mode === "full" && (
                  <div className="m-0.5 h-2 w-2 rounded-full bg-red-600" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                  <Eraser className="mr-1 inline h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  Supprimer et effacer l'impact financier
                </p>
                <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                  Les {impact.seances} séances, présences et inscriptions sont supprimées avec le groupe. Les opérations de consommation liées aux séances ({impact.consommations.count} op.) et les gains professeur liés aux paiements du groupe sont <span className="font-medium text-neutral-700 dark:text-neutral-300">effacés</span>. Les soldes des élèves reviennent à leur valeur réelle.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("only")}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                mode === "only"
                  ? "border-amber-500 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                  : "border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
              )}
            >
              <div className={cn("mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2",
                mode === "only" ? "border-amber-600" : "border-neutral-300 dark:border-neutral-600")}>
                {mode === "only" && (
                  <div className="m-0.5 h-2 w-2 rounded-full bg-amber-600" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                  <Trash2 className="mr-1 inline h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Supprimer le groupe uniquement
                </p>
                <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                  Seules les séances, présences et inscriptions sont supprimées. Les opérations de consommation ({impact.consommations.count} op.) et les gains professeur liés aux paiements du groupe restent dans les comptes <span className="font-medium text-amber-700 dark:text-amber-400">sans référence visible</span> : les soldes ne changeront pas.
                </p>
              </div>
            </button>
          </div>

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
            onClick={() => onConfirm(mode, password)}
            disabled={countdown > 0 || !password.trim() || loading}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed",
              mode === "full" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : countdown > 0 ? (
              <span>Supprimer ({countdown}s)</span>
            ) : (
              <span>{mode === "full" ? "Supprimer et effacer" : "Supprimer uniquement"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}