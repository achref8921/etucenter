"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2, Scale, Send, Wallet } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SkeletonPage } from "@/components/ui/skeleton";

interface DebtRow {
  id: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: "OPEN" | "PARTIAL" | "PAID";
  createdAt: string;
  settledAt: string | null;
  student: { id: string; nom: string; prenom: string };
  groupe?: { id: string; nom: string } | null;
  seance?: { id: string; date: string; statut: string; groupe: { id: string; nom: string } } | null;
  linkedTransactions?: { id: string; type: string; status: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "En attente",
  PARTIAL: "Partielle",
  PAID: "Réglée",
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  PARTIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function ProfDettesPage() {
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "paid">("open");
  const [pendingDeclared, setPendingDeclared] = useState(0);
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [declaring, setDeclaring] = useState(false);

  const fetchDebts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/prof/reverse/debts");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setDebts(data.debts ?? []);
      setPendingDeclared(Number(data.pendingDeclared ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const openDebts = useMemo(() => debts.filter((d) => d.status !== "PAID"), [debts]);
  const paidDebts = useMemo(() => debts.filter((d) => d.status === "PAID"), [debts]);
  const shownDebts = filter === "open" ? openDebts : paidDebts;

  const totalPending = useMemo(
    () => openDebts.reduce((sum, d) => sum + Number(d.balance), 0),
    [openDebts]
  );

  const available = useMemo(
    () => Math.max(0, Math.round((totalPending - pendingDeclared) * 100) / 100),
    [totalPending, pendingDeclared]
  );

  const hasPendingForDebt = (d: DebtRow) =>
    (d.linkedTransactions ?? []).some(
      (t) => t.type === "CENTER_SETTLEMENT" && t.status === "pending"
    );

  const settle = async (debt: DebtRow) => {
    if (!window.confirm(`Régler la part centre de ${formatCurrency(Number(debt.balance))} pour ${debt.student.prenom} ${debt.student.nom} ?`)) {
      return;
    }

    setSettlingId(debt.id);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/prof/reverse/debts/${debt.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(debt.balance) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error((data.error || "").replace(/_/g, " ") || "Erreur lors du règlement");
      }

      setSuccess(`Demande de règlement de ${formatCurrency(Number(debt.balance))} envoyée pour ${debt.student.prenom} ${debt.student.nom}. En attente de confirmation du centre.`);
      await fetchDebts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSettlingId(null);
    }
  };

  const declare = async () => {
    const num = parseFloat(declaredAmount.replace(",", "."));
    if (!num || num <= 0) {
      setError("Veuillez saisir un montant valide.");
      return;
    }
    if (num > available + 0.001) {
      setError(`Le montant ne peut pas dépasser ${formatCurrency(available)}.`);
      return;
    }

    setDeclaring(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/prof/reverse/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error((data.error || "").replace(/_/g, " ") || "Erreur lors de l'envoi");
      }

      setSuccess(`Versement de ${formatCurrency(num)} transmis au centre. En attente de confirmation.`);
      setDeclaredAmount("");
      await fetchDebts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeclaring(false);
    }
  };

  if (loading) {
    return <SkeletonPage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/prof"
          className="flex items-center gap-1 text-[13px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Dettes envers le centre</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-[13px] text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      <div
        className={`animate-fade-in-up rounded-xl border p-6 ${
          totalPending > 0
            ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
            : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-[13px] font-medium ${
                totalPending > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {totalPending > 0 ? "Total dû au centre" : "Plus aucune part à régler"}
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                totalPending > 0 ? "text-amber-900 dark:text-amber-100" : "text-emerald-900 dark:text-emerald-100"
              }`}
            >
              {formatCurrency(Math.abs(totalPending))}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-[#181b22]">
            {totalPending > 0 ? (
              <Scale className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            ) : (
              <Wallet className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
        </div>
      </div>

      {(openDebts.length > 0 || pendingDeclared > 0) && (
        <div className="animate-fade-in-up rounded-xl border border-blue-200 bg-white p-6 dark:border-blue-900 dark:bg-[#181b22]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">
                Déclarer un versement au centre
              </h2>
              <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                Saisissez le montant que vous remettez au centre. Il sera réparti sur vos dettes (les plus anciennes d&apos;abord) après confirmation par le centre.
              </p>
              {pendingDeclared > 0 && (
                <p className="mt-2 text-[12px] font-medium text-amber-600 dark:text-amber-400">
                  En attente de confirmation : {formatCurrency(pendingDeclared)} · Disponible : {formatCurrency(available)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                value={declaredAmount}
                onChange={(ev) => setDeclaredAmount(ev.target.value)}
                placeholder="Ex : 100"
                className="w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-center text-[13px] text-neutral-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600/20 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-100 dark:focus:border-blue-400"
              />
              <button
                onClick={declare}
                disabled={declaring || available <= 0 || !declaredAmount}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {declaring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {debts.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-neutral-300 dark:text-neutral-600" />
          Aucune dette enregistrée.
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#2a2d35] px-5 py-3">
            <div className="flex gap-1">
              <button
                onClick={() => setFilter("open")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${
                  filter === "open"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-600/10 dark:text-blue-400"
                    : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                À régler ({openDebts.length})
              </button>
              <button
                onClick={() => setFilter("paid")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${
                  filter === "paid"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-600/10 dark:text-blue-400"
                    : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                Réglées ({paidDebts.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Élève</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Part centre</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Reste</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Statut</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                {shownDebts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      {filter === "open" ? "Aucune dette à régler" : "Aucune dette réglée"}
                    </td>
                  </tr>
                ) : (
                  shownDebts.map((d) => (
                    <tr key={d.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                      <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">
                        {d.student.prenom} {d.student.nom}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                        <div>{d.groupe?.nom ?? d.seance?.groupe.nom ?? "—"}</div>
                        <div className="text-[12px] text-neutral-400 dark:text-neutral-500">
                          {formatDate(d.seance?.date ?? d.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(Number(d.amountDue))}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(Number(d.balance))}
                      </td>
                      <td className="px-4 py-2.5">
                        {hasPendingForDebt(d) ? (
                          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Confirmation en attente
                          </span>
                        ) : (
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium ${STATUS_BADGE[d.status]}`}>
                            {STATUS_LABEL[d.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {d.status !== "PAID" &&
                          (hasPendingForDebt(d) ? (
                            <span className="text-[12px] font-medium text-amber-600 dark:text-amber-400">
                              En attente…
                            </span>
                          ) : (
                            <button
                              onClick={() => settle(d)}
                              disabled={settlingId === d.id}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {settlingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              Régler
                            </button>
                          ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}