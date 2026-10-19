"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Loader2, RotateCcw, Trash2, Users, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SkeletonPage } from "@/components/ui/skeleton";

interface GroupeRow {
  id: string;
  nom: string;
  statut: string;
}

interface EleveRow {
  id: string;
  nom: string;
  prenom: string;
  email?: string | null;
  solde?: number;
  groupes: { id: string; nom: string }[];
}

interface CollectionRow {
  id: string;
  amount: number;
  centerFee: number;
  netAmount: number;
  collectionPct: number;
  date: string;
  student: { id: string; nom: string; prenom: string };
  groupe?: { id: string; nom: string } | null;
  seance?: { date: string; groupe: { nom: string } } | null;
  debt: { id: string; status: string; balance: number; amountDue: number };
  paiementId?: string | null;
}

export default function ProfEncaisserPage() {
  const [config, setConfig] = useState<{ teacherReverseEnabled: boolean; teacherReversePct: number; hasProfTaux?: boolean } | null>(null);
  const [groupes, setGroupes] = useState<GroupeRow[]>([]);
  const [eleves, setEleves] = useState<EleveRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);

  const [groupeId, setGroupeId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<CollectionRow | null>(null);
  const [cancelMotif, setCancelMotif] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [configRes, groupesRes, elevesRes, colsRes] = await Promise.all([
        fetch("/api/prof/reverse/config"),
        fetch("/api/prof/groupes"),
        fetch("/api/prof/eleves"),
        fetch("/api/prof/reverse/collections"),
      ]);

      if (!configRes.ok || !groupesRes.ok || !elevesRes.ok || !colsRes.ok) {
        throw new Error("Erreur lors du chargement des données");
      }

      const [cfg, grps, elevs, cols] = await Promise.all([
        configRes.json(),
        groupesRes.json(),
        elevesRes.json(),
        colsRes.json(),
      ]);

      setConfig(cfg);
      setGroupes(Array.isArray(grps) ? grps : []);
      setEleves(Array.isArray(elevs) ? elevs : []);
      setCollections(cols.collections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const eligibleGroupes = useMemo(
    () => groupes.filter((g) => g.statut !== "archive"),
    [groupes]
  );

  const selectedGroupe = useMemo(
    () => eligibleGroupes.find((g) => g.id === groupeId),
    [eligibleGroupes, groupeId]
  );

  const eligibleStudents = useMemo(() => {
    if (!selectedGroupe) return [];
    return eleves.filter((e) => e.groupes.some((g) => g.id === selectedGroupe.id));
  }, [eleves, selectedGroupe]);

  useEffect(() => {
    if (!selectedGroupe) {
      setStudentId("");
      return;
    }
    if (eligibleStudents.length > 0 && !eligibleStudents.some((e) => e.id === studentId)) {
      setStudentId(eligibleStudents[0].id);
    } else if (eligibleStudents.length === 0) {
      setStudentId("");
    }
  }, [selectedGroupe, eligibleStudents, studentId]);

  const studentsWithSolde = useMemo(
    () => [...eleves].sort((a, b) => (a.solde ?? 0) - (b.solde ?? 0)),
    [eleves]
  );

  const amountNum = Math.max(0, Number(amount) || 0);
  const pct = config?.teacherReversePct ?? 20;
  const centerFee = Math.round((amountNum * pct) / 100 * 100) / 100;
  const netAmount = Math.round((amountNum - centerFee) * 100) / 100;

  const handleSubmit = async () => {
    if (!groupeId || !studentId) {
      setError("Sélectionnez un groupe et un élève");
      return;
    }
    if (amountNum <= 0) {
      setError("Saisissez un montant valide");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/prof/reverse/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          groupeId,
          amount: amountNum,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const label = (data.error || "").replace(/_/g, " ").toLowerCase();
        throw new Error(
          label
            ? `Opération impossible (${label === "erreur interne du serveur" ? "erreur serveur" : label})`
            : "Erreur lors de l'encaissement"
        );
      }

      setSuccess(
        `Encaissement de ${formatCurrency(amountNum)} enregistré. Part centre : ${formatCurrency(data.breakdown.centerFee)} — à régler depuis « Dettes Centre ».`
      );

      setAmount("");
      setNotes("");

      const colsRes = await fetch("/api/prof/reverse/collections");
      if (colsRes.ok) {
        const cols = await colsRes.json();
        setCollections(cols.collections ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const openCancel = (c: CollectionRow) => {
    setCancelTarget(c);
    setCancelMotif("");
  };

  const handleCancel = async () => {
    if (!cancelTarget?.paiementId || cancelMotif.trim().length < 3) return;
    setCancelSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/prof/reverse/collections/${cancelTarget.paiementId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif: cancelMotif.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'annulation");
      }
      setCancelTarget(null);
      setCancelMotif("");
      setSuccess(`Encaissement de ${formatCurrency(cancelTarget.amount)} annulé. L'élève a été notifié.`);
      const colsRes = await fetch("/api/prof/reverse/collections");
      if (colsRes.ok) {
        const cols = await colsRes.json();
        setCollections(cols.collections ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setCancelSubmitting(false);
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
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Encaisser un paiement d'élève</h1>
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

      {config && !config.teacherReverseEnabled && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-[13px] text-amber-700 dark:text-amber-400">
          La collecte inverse n'est pas activée pour ce centre. Contactez l'administrateur.
        </div>
      )}

      {config && config.teacherReverseEnabled && config.hasProfTaux === false && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-[13px] text-amber-700 dark:text-amber-400">
          Aucun taux ne vous a été attribué. La part centre par défaut ({config.teacherReversePct}%) est utilisée. Demandez à l'administrateur de définir votre taux dans « Bénéfices ».
        </div>
      )}

      {config && config.teacherReverseEnabled && (
        <>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white p-5 dark:bg-[#181b22]">
            <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
              Nouvel encaissement
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
              L'élève vous paie en mains propres pour un groupe donné. La part du centre vous est due : réglez-la depuis la page « Dettes Centre ».
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
                  Groupe
                </label>
                <select
                  value={groupeId}
                  onChange={(e) => setGroupeId(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 dark:border-[#2a2d35] bg-white px-3 py-2 text-[13px] text-neutral-900 dark:bg-[#1e2128] dark:text-neutral-100"
                >
                  <option value="">— Sélectionner —</option>
                  {eligibleGroupes.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
                  Élève
                </label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={!selectedGroupe}
                  className="w-full rounded-md border border-neutral-300 dark:border-[#2a2d35] bg-white px-3 py-2 text-[13px] text-neutral-900 dark:bg-[#1e2128] dark:text-neutral-100 disabled:opacity-50"
                >
                  <option value="">{selectedGroupe ? "— Sélectionner —" : "Choisissez d'abord un groupe"}</option>
                  {eligibleStudents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.prenom} {e.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
                  Montant encaissé (DT)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex : 100"
                  className="w-full rounded-md border border-neutral-300 dark:border-[#2a2d35] bg-white px-3 py-2 text-[13px] tabular-nums text-neutral-900 dark:bg-[#1e2128] dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
                  Notes (optionnel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-neutral-300 dark:border-[#2a2d35] bg-white px-3 py-2 text-[13px] text-neutral-900 dark:bg-[#1e2128] dark:text-neutral-100"
                />
              </div>

              <div className="rounded-lg border border-blue-100 dark:border-blue-950/50 bg-blue-50/60 dark:bg-blue-600/5 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Répartition ({pct}% pour le centre)
                </p>
                <div className="mt-2 space-y-1 text-[13px]">
                  <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-200">
                    <span>Montant encaissé</span>
                    <span className="tabular-nums font-semibold">{formatCurrency(amountNum)}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-200">
                    <span>Part centre (à régler)</span>
                    <span className="tabular-nums font-semibold text-blue-700 dark:text-blue-400">{formatCurrency(centerFee)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-neutral-200 dark:border-[#2a2d35] pt-1 text-neutral-700 dark:text-neutral-200">
                    <span>Net prof</span>
                    <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(netAmount)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !groupeId || !studentId || amountNum <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                {submitting ? "Enregistrement..." : "Enregistrer l'encaissement"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#2a2d35] px-5 py-3">
              <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                Derniers encaissements
              </h2>
              <button
                onClick={() => fetchAll()}
                className="flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400"
              >
                <RotateCcw className="h-3 w-3" /> Actualiser
              </button>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {collections.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
                  Aucun encaissement pour le moment
                </p>
              ) : (
                collections.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                        {c.student.prenom} {c.student.nom}
                      </p>
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        {formatDate(c.date)} · {c.groupe?.nom ?? c.seance?.groupe.nom ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[13px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(c.amount)}
                        </p>
                        <p className="text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400">
                          Part centre : {formatCurrency(c.centerFee)}
                        </p>
                      </div>
                      {c.paiementId && (
                        <button
                          onClick={() => openCancel(c)}
                          className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Annuler cet encaissement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#2a2d35] px-5 py-3">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
              <Users className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              Mes élèves ({studentsWithSolde.length})
            </h2>
            <span className="text-[12px] text-neutral-500 dark:text-neutral-400">Solde du compte</span>
          </div>
          <div className="max-h-[420px] divide-y divide-neutral-100 overflow-y-auto dark:divide-[#2a2d35]">
            {studentsWithSolde.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
                Aucun élève pour le moment
              </p>
            ) : (
              studentsWithSolde.map((e) => {
                const solde = e.solde ?? 0;
                return (
                  <Link
                    key={e.id}
                    href={`/prof/eleves/${e.id}`}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] ${
                      studentId === e.id ? "bg-blue-50 dark:bg-blue-600/10" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                        {e.prenom} {e.nom}
                      </p>
                      <p className="truncate text-[12px] text-neutral-500 dark:text-neutral-400">
                        {e.groupes.map((g) => g.nom).join(" · ") || "—"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-0.5 text-[12px] font-semibold tabular-nums ${
                        solde > 0
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : solde < 0
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-neutral-100 text-neutral-700 dark:bg-[#2a2d35] dark:text-neutral-200"
                      }`}
                    >
                      {solde > 0 ? "+" : ""}
                      {formatCurrency(solde)}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
        </>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white p-0 shadow-xl dark:border-[#2a2d35] dark:bg-[#181b22]">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Annuler l&apos;encaissement
              </h2>
              <button
                onClick={() => setCancelTarget(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] dark:border-red-900/40 dark:bg-red-900/20">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {cancelTarget.student.prenom} {cancelTarget.student.nom} — {formatCurrency(cancelTarget.amount)} — {cancelTarget.groupe?.nom ?? "—"}
                </p>
                <p className="mt-1 text-red-600 dark:text-red-400">
                  Action définitive : l&apos;encaissement et ses écritures (crédit élève, part centre due) seront effacés. L&apos;élève recevra une notification avec le motif.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
                  Motif de l&apos;annulation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelMotif}
                  onChange={(e) => setCancelMotif(e.target.value)}
                  rows={3}
                  required
                  placeholder="Ex : Encaissement par erreur, mauvais montant, mauvais élève..."
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[13px] text-neutral-900 dark:border-[#2a2d35] dark:bg-[#1e2128] dark:text-neutral-100"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <button
                onClick={() => setCancelTarget(null)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-[#2a2d35] dark:bg-[#1e2128] dark:text-neutral-300 dark:hover:bg-[#242833]"
              >
                Retour
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelSubmitting || cancelMotif.trim().length < 3}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}