"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Plus,
  X,
  FileText,
  Undo2,
  Wallet,
  Users,
  ArrowLeft,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

interface TeacherRow {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  actif: boolean;
  balance: number;
}

interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount: number;
  signedAmount: number;
  description: string;
  paymentMethod: string | null;
  date: string;
  receiptNumber: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  teacher: { id: string; nom: string; prenom: string };
  reversalOf: { id: string; type: string; amount: number } | null;
}

const TYPE_LABEL: Record<string, string> = {
  EARNING: "Gain",
  PAYMENT: "Paiement",
  ADJUSTMENT: "Ajustement",
  REVERSAL: "Annulation",
};

const METHODE_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

export default function FinancesProfesseursPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const selectedId = searchParams.get("teacherId") || "";
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: "PAYMENT",
    amount: 0,
    credit: true,
    date: "",
    paymentMethod: "especes",
    reference: "",
    notes: "",
  });

  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<TransactionRow | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const fetchTeachers = useCallback(async () => {
    try {
      setLoadingTeachers(true);
      const res = await fetch("/api/admin/teacher-finance/summary");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setTeachers(data);
      if (!selectedId && data.length > 0) {
        router.replace(`/admin/finances-professeurs?teacherId=${data[0].id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoadingTeachers(false);
    }
  }, [selectedId, router]);

  const fetchLedger = useCallback(
    async (teacherId: string, pageNum: number) => {
      try {
        setLoadingLedger(true);
        setError(null);
        const res = await fetch(
          `/api/admin/teacher-finance?teacherId=${teacherId}&page=${pageNum}`
        );
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setTransactions(data.transactions);
        setBalance(data.balance);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoadingLedger(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  useEffect(() => {
    if (selectedId) {
      fetchLedger(selectedId, 1);
    }
  }, [selectedId, fetchLedger]);

  const selectedTeacher = teachers.find((t) => t.id === selectedId);

  const openModal = () => {
    setForm({
      type: "PAYMENT",
      amount: 0,
      credit: true,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: "especes",
      reference: "",
      notes: "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || form.amount <= 0) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/admin/teacher-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedId,
          type: form.type,
          amount: form.amount,
          credit: form.credit,
          date: form.date,
          paymentMethod: form.paymentMethod,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'enregistrement");
      }
      setShowModal(false);
      fetchTeachers();
      fetchLedger(selectedId, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const openReverse = (tx: TransactionRow) => {
    setReverseTarget(tx);
    setReverseReason("");
    setShowReverseModal(true);
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseTarget || !reverseReason.trim()) return;
    try {
      setReversing(true);
      setError(null);
      const res = await fetch(
        `/api/admin/teacher-finance/${reverseTarget.id}/reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reverseReason }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'annulation");
      }
      setShowReverseModal(false);
      setReverseTarget(null);
      fetchTeachers();
      fetchLedger(selectedId, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setReversing(false);
    }
  };

  const openReceipt = (tx: TransactionRow) => {
    window.open(`/api/admin/teacher-finance/${tx.id}/receipt`, "_blank");
  };

  if (loadingTeachers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Comptes Professeurs
          </h1>
        </div>
        {selectedId && (
          <button
            onClick={openModal}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nouvelle transaction
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <Users className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            Professeurs ({teachers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Professeur
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Contact
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Solde
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {teachers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400"
                  >
                    Aucun professeur
                  </td>
                </tr>
              ) : (
                teachers.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() =>
                      router.replace(`/admin/finances-professeurs?teacherId=${t.id}`)
                    }
                    className={`cursor-pointer transition-colors ${
                      selectedId === t.id
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {t.prenom} {t.nom}
                      </p>
                      {!t.actif && (
                        <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                      {t.email}
                      {t.telephone ? ` — ${t.telephone}` : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold ${
                          t.balance > 0
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : t.balance < 0
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-neutral-100 text-neutral-700 dark:bg-[#2a2d35] dark:text-neutral-200"
                        }`}
                      >
                        {t.balance !== 0 && (t.balance > 0 ? "+" : "−")}
                        {formatCurrency(Math.abs(t.balance))}
                      </span>
                      <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {t.balance > 0
                          ? "à payer"
                          : t.balance < 0
                            ? "à recevoir"
                            : "solde nul"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/professeurs/${t.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Profil
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
          <div className="flex flex-col gap-3 border-b border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Wallet className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              Grand livre — {selectedTeacher?.prenom} {selectedTeacher?.nom}
            </h2>
            {selectedTeacher && (
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-semibold ${
                  balance > 0
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : balance < 0
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-neutral-100 text-neutral-700 dark:bg-[#2a2d35] dark:text-neutral-200"
                }`}
              >
                Solde : {balance !== 0 && (balance > 0 ? "+" : "−")}
                {formatCurrency(Math.abs(balance))}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Méthode
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Montant
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Reçu
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
                {loadingLedger ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400"
                    >
                      Aucune transaction
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] ${
                        tx.status === "reversed" ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            tx.type === "REVERSAL"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              : tx.type === "PAYMENT"
                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                                : tx.type === "EARNING"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400"
                          }`}
                        >
                          {TYPE_LABEL[tx.type]}
                        </span>
                        {tx.status === "reversed" && (
                          <span className="ml-1 inline-block rounded-full bg-neutral-100 dark:bg-[#2a2d35] px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                            Annulé
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-2.5">
                        <p className="truncate text-neutral-600 dark:text-neutral-400">
                          {tx.description}
                        </p>
                        {tx.receiptNumber && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">
                            {tx.receiptNumber}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                        {tx.paymentMethod
                          ? METHODE_LABEL[tx.paymentMethod] || tx.paymentMethod
                          : "—"}
                      </td>
                      <td
                        className={`px-4 py-2.5 font-semibold ${
                          Number(tx.signedAmount) >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {Number(tx.signedAmount) >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(Number(tx.amount)))}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => openReceipt(tx)}
                          className="rounded p-1 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] hover:text-emerald-600 dark:hover:text-emerald-400"
                          title="Imprimer le reçu"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        {tx.type !== "REVERSAL" && tx.status === "active" && (
                          <button
                            onClick={() => openReverse(tx)}
                            className="rounded p-1 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] hover:text-red-600 dark:hover:text-red-400"
                            title="Annuler la transaction"
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-200 dark:border-[#2a2d35] px-4 py-2.5">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {total} transaction(s) — Page {page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchLedger(selectedId, page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128] disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => fetchLedger(selectedId, page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128] disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Nouvelle transaction — {selectedTeacher.prenom} {selectedTeacher.nom}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="PAYMENT">Paiement (argent versé au professeur)</option>
                  <option value="EARNING">Gain (gain enregistré au crédit)</option>
                  <option value="ADJUSTMENT">Ajustement (correction manuelle)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Montant (DT)
                </label>
                <input
                  type="number"
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  min={0}
                  step="0.01"
                  required
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              {form.type === "ADJUSTMENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Sens
                  </label>
                  <select
                    value={form.credit ? "credit" : "debit"}
                    onChange={(e) => setForm({ ...form, credit: e.target.value === "credit" })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="credit">Crédit (+ augmente le solde)</option>
                    <option value="debit">Débit (− diminue le solde)</option>
                  </select>
                </div>
              )}

              {form.type === "PAYMENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Méthode de paiement
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="especes">Espèces</option>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Référence
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Optionnel"
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Optionnel"
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || form.amount <= 0}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReverseModal && reverseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Annuler la transaction</h2>
              <button
                onClick={() => setShowReverseModal(false)}
                className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3 text-sm">
              <p className="text-neutral-600 dark:text-neutral-400">
                <span className="font-medium">{TYPE_LABEL[reverseTarget.type]}</span> —{" "}
                {reverseTarget.description}
              </p>
              <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                Montant :{" "}
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(Math.abs(Number(reverseTarget.amount)))}
                </span>
              </p>
            </div>
            <form onSubmit={handleReverse} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Raison de l'annulation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Expliquez la raison..."
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={reversing || !reverseReason.trim()}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {reversing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmer l'annulation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
