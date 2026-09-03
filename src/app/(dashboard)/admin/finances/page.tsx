"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Plus,
  X,
  Pencil,
  FileText,
  Undo2,
  Wallet,
  Users,
  Search,
  Eye,
  Coins,
} from "lucide-react";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils";

interface Stats {
  totalRevenue: number;
  totalPaid: number;
  totalUnpaid: number;
}

interface Paiement {
  id: string;
  montant: number;
  datePaiement: string;
  methodePaiement: string;
  notes: string | null;
  groupe: { id: string; nom: string };
  eleve: { id: string; nom: string; prenom: string };
}

interface EleveOption {
  id: string;
  nom: string;
  prenom: string;
  codeEleve: string | null;
  niveau: string | null;
  classe: string | null;
  filiere: string | null;
  groupes: {
    groupe: { id: string; nom: string; prixParSeance: number };
    totalDue: number;
    totalPaid: number;
    unpaid: number;
  }[];
}

interface StudentRow {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  codeEleve: string | null;
  classe: string | null;
  actif: boolean;
  balance: number;
  inscriptions: { id: string; nom: string; prixParSeance: number | null; matiere: string | null }[];
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
  eleve: { id: string; nom: string; prenom: string; codeEleve: string | null };
  attendance: {
    seance: {
      id: string;
      date: string;
      groupe: { id: string; nom: string; matiere: { nom: string } | null };
    };
  } | null;
  reversalOf: { id: string; type: string; amount: number; receiptNumber: string | null } | null;
}

const TYPE_LABEL: Record<string, string> = {
  PREPAYMENT: "Pré-paiement",
  COURSE_CONSUMPTION: "Consommation",
  ADJUSTMENT: "Ajustement",
  REVERSAL: "Annulation",
};

const TYPE_BADGE: Record<string, string> = {
  PREPAYMENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  COURSE_CONSUMPTION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ADJUSTMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  REVERSAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const METHODE_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

const classesByNiveau: Record<string, string[]> = {
  primaire: ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année", "6ème année"],
  college: ["7ème", "8ème", "9ème"],
  lycee: ["1ère", "2ème", "3ème", "Bac"],
};

const filieres = [
  { value: "lettres", label: "Lettres" },
  { value: "economique", label: "Économique" },
  { value: "informatique", label: "Informatique" },
  { value: "technique", label: "Technique" },
  { value: "sciences", label: "Sciences" },
  { value: "math", label: "Mathématiques" },
];

export default function FinancesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eleves, setEleves] = useState<EleveOption[]>([]);
  const [selectedEleveId, setSelectedEleveId] = useState("");
  const [selectedGroupeId, setSelectedGroupeId] = useState("");
  const [montant, setMontant] = useState<number>(0);
  const [methodePaiement, setMethodePaiement] = useState("especes");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterClasse, setFilterClasse] = useState("");
  const [filterFiliere, setFilterFiliere] = useState("");
  const [searchEleve, setSearchEleve] = useState("");

  const [editModal, setEditModal] = useState(false);
  const [editPaiement, setEditPaiement] = useState<Paiement | null>(null);
  const [editMontant, setEditMontant] = useState<number>(0);
  const [editRaison, setEditRaison] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState("");

  const selectedId = searchParams.get("studentId") || "";
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [filters, setFilters] = useState({ type: "", from: "", to: "" });

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditSearch, setCreditSearch] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [creditForm, setCreditForm] = useState({
    type: "PREPAYMENT",
    studentId: "",
    groupeId: "",
    amount: 0,
    credit: true,
    date: "",
    time: "",
    paymentMethod: "especes",
    notes: "",
  });

  const [showDetail, setShowDetail] = useState(false);
  const [detailTx, setDetailTx] = useState<TransactionRow | null>(null);

  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<TransactionRow | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const refreshAll = async () => {
    await Promise.all([
      fetchData(),
      fetchStudents(false),
      selectedId ? fetchLedger(selectedId, page, filters) : Promise.resolve(),
    ]);
  };

  const fetchData = async () => {
    try {
      setError(null);
      const [statsRes, paiementsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/paiements"),
      ]);
      if (!statsRes.ok) throw new Error("Erreur lors du chargement des stats");
      const statsData = await statsRes.json();
      setStats(statsData.stats || statsData);
      if (paiementsRes.ok) {
        const paiementsData = await paiementsRes.json();
        setPaiements(paiementsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const fetchStudents = useCallback(
    async (selectFirst = true) => {
      try {
        setLoadingStudents(true);
        const res = await fetch("/api/admin/student-finance/summary");
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setStudents(data);
        if (selectFirst && !selectedId && data.length > 0) {
          router.replace(`/admin/finances?studentId=${data[0].id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoadingStudents(false);
      }
    },
    [selectedId, router]
  );

  const fetchLedger = useCallback(
    async (studentId: string, pageNum: number, extra: { type?: string; from?: string; to?: string } = {}) => {
      try {
        setLoadingLedger(true);
        setError(null);
        const params = new URLSearchParams({ studentId, page: String(pageNum) });
        if (extra.type) params.set("type", extra.type);
        if (extra.from) params.set("from", extra.from);
        if (extra.to) params.set("to", extra.to);
        const res = await fetch(`/api/admin/student-finance?${params.toString()}`);
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
    (async () => {
      setLoading(true);
      await Promise.all([fetchData(), fetchStudents(true)]);
      setLoading(false);
    })();
  }, [fetchStudents]);

  useEffect(() => {
    if (selectedId) {
      fetchLedger(selectedId, 1, filters);
    }
  }, [selectedId, fetchLedger, filters]);

  const selectedStudent = students.find((s) => s.id === selectedId);

  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${s.prenom} ${s.nom}`.toLowerCase().includes(q) ||
      (s.codeEleve || "").toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  const filteredCreditStudents = students.filter((s) => {
    const q = creditSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      `${s.prenom} ${s.nom}`.toLowerCase().includes(q) ||
      (s.codeEleve || "").toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  const creditStudentGroups = (studentId: string) =>
    students.find((s) => s.id === studentId)?.inscriptions ?? [];

  const fetchEleves = async () => {
    try {
      const res = await fetch("/api/admin/eleves");
      if (res.ok) {
        const data = await res.json();
        setEleves(data);
      }
    } catch {
      // silent
    }
  };

  const openModal = () => {
    setShowModal(true);
    setSelectedEleveId("");
    setSelectedGroupeId("");
    setMontant(0);
    setMethodePaiement("especes");
    setReference("");
    setNotes("");
    setFilterNiveau("");
    setFilterClasse("");
    setFilterFiliere("");
    setSearchEleve("");
    fetchEleves();
  };

  const selectedEleve = eleves.find((e) => e.id === selectedEleveId);
  const selectedGroupeData = selectedEleve?.groupes.find(
    (g) => g.groupe.id === selectedGroupeId
  );

  const filteredEleves = eleves.filter((e) => {
    if (filterNiveau && e.niveau !== filterNiveau) return false;
    if (filterClasse && e.classe !== filterClasse) return false;
    if (filterFiliere && e.filiere !== filterFiliere) return false;
    const q = searchEleve.trim().toLowerCase();
    if (q) {
      const fullName = `${e.prenom} ${e.nom}`.toLowerCase();
      const code = (e.codeEleve || "").toLowerCase();
      if (!fullName.includes(q) && !code.includes(q)) return false;
    }
    return true;
  });

  const availableClasses = filterNiveau ? classesByNiveau[filterNiveau] || [] : [];
  const showFiliere = filterNiveau === "lycee" && filterClasse && ["2ème", "3ème", "Bac"].includes(filterClasse);

  const openEditModal = (p: Paiement) => {
    setEditPaiement(p);
    setEditMontant(Number(p.montant));
    setEditRaison("");
    setEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaiement || editMontant <= 0 || !editRaison.trim()) return;
    try {
      setEditSubmitting(true);
      setError(null);
      const res = await fetch(`/api/admin/paiements/${editPaiement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: editMontant, raison: editRaison }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la modification");
      }
      setEditModal(false);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEleveId || !selectedGroupeId || montant <= 0) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/admin/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eleveId: selectedEleveId,
          groupeId: selectedGroupeId,
          montant,
          methodePaiement,
          reference,
          notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'enregistrement");
      }
      setShowModal(false);
      if (selectedId !== selectedEleveId) {
        router.replace(`/admin/finances?studentId=${selectedEleveId}`);
      }
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreditModal = () => {
    const defaultStudentId = selectedId || (students[0]?.id ?? "");
    const defaultGroups = creditStudentGroups(defaultStudentId);
    setCreditForm({
      type: "PREPAYMENT",
      studentId: defaultStudentId,
      groupeId: defaultGroups.length === 1 ? defaultGroups[0].id : "",
      amount: 0,
      credit: true,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      paymentMethod: "especes",
      notes: "",
    });
    setIdempotencyKey(crypto.randomUUID());
    setCreditSearch("");
    setShowCreditModal(true);
  };

  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditForm.studentId || creditForm.amount <= 0) return;
    try {
      setCreditSubmitting(true);
      setError(null);
      const res = await fetch("/api/admin/student-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: creditForm.studentId,
          type: creditForm.type,
          groupeId: creditForm.groupeId || null,
          amount: creditForm.amount,
          credit: creditForm.credit,
          date: creditForm.date,
          time: creditForm.time,
          paymentMethod: creditForm.paymentMethod,
          notes: creditForm.notes || null,
          idempotencyKey,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'enregistrement");
      }
      setShowCreditModal(false);
      if (creditForm.studentId !== selectedId) {
        router.replace(`/admin/finances?studentId=${creditForm.studentId}`);
      }
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setCreditSubmitting(false);
    }
  };

  const openDetail = (tx: TransactionRow) => {
    setDetailTx(tx);
    setShowDetail(true);
  };

  const openReverse = (tx: TransactionRow) => {
    setReverseTarget(tx);
    setReverseReason("");
    setShowReverseModal(true);
  };

  const handleReverse = async () => {
    if (!reverseTarget || !reverseReason.trim()) return;
    try {
      setReversing(true);
      setError(null);
      const res = await fetch(`/api/admin/student-finance/${reverseTarget.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reverseReason }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'annulation");
      }
      setShowReverseModal(false);
      setReverseTarget(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setReversing(false);
    }
  };

  const openReceipt = (tx: TransactionRow) => {
    window.open(`/api/admin/student-finance/${tx.id}/receipt`, "_blank");
  };

  const applyFilters = () => {
    if (selectedId) fetchLedger(selectedId, 1, filters);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Finances</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openModal}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Enregistrer un paiement
          </button>
          <button
            onClick={openCreditModal}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
          >
            <Coins className="h-4 w-4" />
            Ajouter un crédit
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-neutral-500 dark:text-neutral-400">Revenus Totaux</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-neutral-500 dark:text-neutral-400">Total Payé</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(stats.totalPaid)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-neutral-500 dark:text-neutral-400">Impayés</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(stats.totalUnpaid)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6lg:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
          <div className="border-b border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Users className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              Élèves ({filteredStudents.length})
            </h2>
          </div>
          <div className="border-b border-neutral-200 dark:border-[#2a2d35] p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] pl-9 pr-3 py-2 text-[13px] text-neutral-900 dark:text-neutral-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {loadingStudents ? (
              <p className="px-6 py-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                Aucun élève
              </p>
            ) : (
              filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    router.replace(`/admin/finances?studentId=${s.id}`)
                  }
                  className={`block w-full border-b border-neutral-100 dark:border-[#2a2d35] px-4 py-3 text-left transition-colors ${
                    selectedId === s.id
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {s.prenom} {s.nom}
                      </p>
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {s.codeEleve ? `#${s.codeEleve}` : ""} {s.classe ? `· ${s.classe}` : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        s.balance > 0
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : s.balance < 0
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-neutral-100 text-neutral-700 dark:bg-[#2a2d35] dark:text-neutral-200"
                      }`}
                    >
                      {s.balance > 0 ? "+" : ""}
                      {s.balance.toLocaleString("fr-TN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {!selectedId ? (
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-12 text-center">
              <Coins className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                Sélectionnez un élève pour voir son compte financier
              </p>
            </div>
          ) : (
            <>
              <div
                className={`rounded-lg border p-6 ${
                  balance > 0
                    ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10"
                    : balance < 0
                      ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10"
                      : "border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                        balance > 0
                          ? "bg-green-500"
                          : balance < 0
                            ? "bg-red-500"
                            : "bg-neutral-400 dark:bg-[#1e2128]"
                      }`}
                    >
                      <Wallet className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                        Solde du compte
                      </p>
                      <p
                        className={`text-3xl font-bold ${
                          balance > 0
                            ? "text-green-700 dark:text-green-400"
                            : balance < 0
                              ? "text-red-700 dark:text-red-400"
                              : "text-neutral-900 dark:text-neutral-100"
                        }`}
                      >
                        {balance > 0 ? "+" : ""}
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {selectedStudent && (
                      <Link
                        href={`/admin/eleves/${selectedStudent.id}`}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Profil élève
                      </Link>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  {balance > 0
                    ? "Solde prépayé disponible pour l'élève."
                    : balance < 0
                      ? `L'élève doit ${formatCurrency(Math.abs(balance))} au centre.`
                      : "Solde épuisé."}
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
                <div className="border-b border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Grand livre des transactions ({total})
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2 py-1.5 text-xs text-neutral-900 dark:text-neutral-100"
                      >
                        <option value="">Tous les types</option>
                        <option value="PREPAYMENT">Pré-paiement</option>
                        <option value="COURSE_CONSUMPTION">Consommation</option>
                        <option value="ADJUSTMENT">Ajustement</option>
                        <option value="REVERSAL">Annulation</option>
                      </select>
                      <input
                        type="date"
                        value={filters.from}
                        onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                        className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2 py-1.5 text-xs text-neutral-900 dark:text-neutral-100"
                      />
                      <span className="text-xs text-neutral-400">→</span>
                      <input
                        type="date"
                        value={filters.to}
                        onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                        className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2 py-1.5 text-xs text-neutral-900 dark:text-neutral-100"
                      />
                      <button
                        onClick={applyFilters}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Filtrer
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
                      <tr>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Type</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Description</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Méthode</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Montant</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Reçu</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
                      {loadingLedger ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-10 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                          </td>
                        </tr>
                      ) : transactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-10 text-center text-neutral-500 dark:text-neutral-400">
                            Aucune transaction
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr
                            key={tx.id}
                            onClick={() => openDetail(tx)}
                            className={`cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] ${
                              tx.status === "reversed" ? "opacity-50" : ""
                            }`}
                          >
                            <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                              {formatDate(tx.date)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    TYPE_BADGE[tx.type] || ""
                                  }`}
                                >
                                  {TYPE_LABEL[tx.type] || tx.type}
                                </span>
                                {tx.status === "reversed" && (
                                  <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                                    Annulé
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="max-w-[220px] px-4 py-2.5">
                              <p className="truncate text-neutral-900 dark:text-neutral-100">{tx.description}</p>
                              {tx.attendance && (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {tx.attendance.seance.groupe.nom}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                              {tx.paymentMethod ? (METHODE_LABEL[tx.paymentMethod] || tx.paymentMethod) : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`font-semibold ${
                                  tx.signedAmount >= 0
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {tx.signedAmount >= 0 ? "+" : ""}
                                {formatCurrency(tx.signedAmount)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                              {tx.receiptNumber || "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    openDetail(tx);
                                  }}
                                  title="Détails"
                                  className="rounded-lg p-1.5 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    openReceipt(tx);
                                  }}
                                  title="Reçu"
                                  className="rounded-lg p-1.5 text-blue-600 dark:text-blue-400 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                                {tx.type !== "REVERSAL" && tx.status === "active" && (
                                  <button
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      openReverse(tx);
                                    }}
                                    title="Annuler"
                                    className="rounded-lg p-1.5 text-red-600 dark:text-red-400 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                                  >
                                    <Undo2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
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
                      Page {page} / {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchLedger(selectedId, page - 1, filters)}
                        disabled={page <= 1}
                        className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-3 py-1.5 text-sm disabled:opacity-40"
                      >
                        Précédent
                      </button>
                      <button
                        onClick={() => fetchLedger(selectedId, page + 1, filters)}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-3 py-1.5 text-sm disabled:opacity-40"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Historique des Paiements</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Élève</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Montant</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Méthode</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {paiements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400">
                  Aucune transaction trouvée
                </td>
              </tr>
            ) : (
              paiements.map((paiement) => (
                <tr key={paiement.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {formatDateTime(paiement.datePaiement)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/eleves/${paiement.eleve.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {paiement.eleve.prenom} {paiement.eleve.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{paiement.groupe.nom}</td>
                  <td className="px-4 py-2.5 font-medium">{formatCurrency(paiement.montant)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block rounded-full bg-neutral-100 dark:bg-[#1e2128] px-2.5 py-0.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {paiement.methodePaiement}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => window.open(`/api/paiements/${paiement.id}/facture`, "_blank")}
                        className="rounded p-1 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Générer la facture"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(paiement)}
                        className="rounded p-1 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] hover:text-blue-600 dark:hover:text-blue-400"
                        title="Modifier le montant"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-0 shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">Filtrer par classe</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <select
                      value={filterNiveau}
                      onChange={(e) => { setFilterNiveau(e.target.value); setFilterClasse(""); setFilterFiliere(""); setSelectedEleveId(""); setSelectedGroupeId(""); setMontant(0); }}
                      className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-2 py-1.5 text-xs focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                    >
                      <option value="">Niveau</option>
                      <option value="primaire">Primaire</option>
                      <option value="college">Collège</option>
                      <option value="lycee">Lycée</option>
                    </select>
                  </div>
                  <div>
                    <select
                      value={filterClasse}
                      onChange={(e) => { setFilterClasse(e.target.value); setFilterFiliere(""); setSelectedEleveId(""); setSelectedGroupeId(""); setMontant(0); }}
                      disabled={!filterNiveau}
                      className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-2 py-1.5 text-xs focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                    >
                      <option value="">Classe</option>
                      {availableClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <select
                      value={filterFiliere}
                      onChange={(e) => { setFilterFiliere(e.target.value); setSelectedEleveId(""); setSelectedGroupeId(""); setMontant(0); }}
                      disabled={!showFiliere}
                      className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-2 py-1.5 text-xs focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                    >
                      <option value="">Filière</option>
                      {filieres.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
                {(filterNiveau || filterClasse || filterFiliere) && (
                  <button
                    type="button"
                    onClick={() => { setFilterNiveau(""); setFilterClasse(""); setFilterFiliere(""); setSelectedEleveId(""); setSelectedGroupeId(""); setMontant(0); }}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Réinitialiser le filtre
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchEleve}
                  onChange={(e) => {
                    setSearchEleve(e.target.value);
                    setSelectedEleveId("");
                    setSelectedGroupeId("");
                    setMontant(0);
                  }}
                  placeholder="Rechercher un élève par nom ou code..."
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 pl-9 pr-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Élève
                  {filteredEleves.length > 0 && (
                    <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">({filteredEleves.length})</span>
                  )}
                </label>
                <select
                  value={selectedEleveId}
                  onChange={(e) => {
                    setSelectedEleveId(e.target.value);
                    setSelectedGroupeId("");
                    setMontant(0);
                  }}
                  required
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="">Sélectionner un élève</option>
                  {filteredEleves.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.codeEleve ? `[${e.codeEleve}] ` : ""}{e.prenom} {e.nom}{e.classe ? ` — ${e.classe}` : ""}
                    </option>
                  ))}
                </select>
                {filteredEleves.length === 0 && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Aucun élève trouvé pour ce filtre.</p>
                )}
              </div>

              {selectedEleve && selectedEleve.groupes.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Groupe</label>
                  <select
                    value={selectedGroupeId}
                    onChange={(e) => {
                      setSelectedGroupeId(e.target.value);
                      const gd = selectedEleve.groupes.find(
                        (g) => g.groupe.id === e.target.value
                      );
                      if (gd) setMontant(gd.unpaid > 0 ? gd.unpaid : 0);
                    }}
                    required
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="">Sélectionner un groupe</option>
                    {selectedEleve.groupes.map((g) => (
                      <option key={g.groupe.id} value={g.groupe.id}>
                        {g.groupe.nom} — Impayé: {formatCurrency(g.unpaid)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedEleve && selectedEleve.groupes.length === 0 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Cet élève n&apos;est inscrit à aucun groupe.</p>
              )}

              {selectedGroupeData && (
                <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Total dû</span>
                    <span className="font-medium">{formatCurrency(selectedGroupeData.totalDue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Total payé</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(selectedGroupeData.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Impayé</span>
                    <span className={`font-medium ${selectedGroupeData.unpaid > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      {formatCurrency(selectedGroupeData.unpaid)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Montant (DT)</label>
                <input
                  type="number"
                  value={montant || ""}
                  onChange={(e) => setMontant(Number(e.target.value))}
                  min={0}
                  required
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Méthode de paiement</label>
                <select
                  value={methodePaiement}
                  onChange={(e) => setMethodePaiement(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="especes">Espèces</option>
                  <option value="virement">Virement</option>
                  <option value="cheque">Chèque</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Référence</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Numéro de référence (optionnel)"
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes (optionnel)"
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedEleveId || !selectedGroupeId || montant <= 0}
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

      {editModal && editPaiement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-0 shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <h2 className="text-lg font-semibold">Modifier le paiement</h2>
              <button onClick={() => setEditModal(false)} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3 text-sm">
                <p className="text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium">{editPaiement.eleve.prenom} {editPaiement.eleve.nom}</span>
                  {" — "}
                  {editPaiement.groupe.nom}
                </p>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  Montant actuel: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(editPaiement.montant)}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Nouveau montant (DT)</label>
                  <input
                    type="number"
                    value={editMontant || ""}
                    onChange={(e) => setEditMontant(Number(e.target.value))}
                    min={0}
                    required
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  {editMontant !== Number(editPaiement.montant) && (
                    <p className={`mt-1 text-xs ${editMontant > Number(editPaiement.montant) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {editMontant > Number(editPaiement.montant) ? "+" : ""}
                      {editMontant - Number(editPaiement.montant)} DT
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Raison de la modification <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editRaison}
                    onChange={(e) => setEditRaison(e.target.value)}
                    rows={3}
                    required
                    placeholder="Expliquez la raison de cette modification..."
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
                <button
                  type="button"
                  onClick={() => setEditModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || editMontant <= 0 || !editRaison.trim() || editMontant === Number(editPaiement.montant)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-0 shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Ajouter un crédit
              </h2>
              <button
                onClick={() => setShowCreditModal(false)}
                className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreditSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Élève
                  {filteredCreditStudents.length > 0 && (
                    <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">({filteredCreditStudents.length})</span>
                  )}
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={creditSearch}
                    onChange={(e) => {
                      setCreditSearch(e.target.value);
                      setCreditForm({ ...creditForm, studentId: "" });
                    }}
                    placeholder="Rechercher un élève par nom ou code..."
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 pl-9 pr-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <select
                  value={creditForm.studentId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const groups = creditStudentGroups(sid);
                    setCreditForm({
                      ...creditForm,
                      studentId: sid,
                      groupeId: groups.length === 1 ? groups[0].id : "",
                    });
                  }}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Sélectionner un élève</option>
                  {filteredCreditStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.prenom} {s.nom} {s.codeEleve ? `(#${s.codeEleve})` : ""}
                    </option>
                  ))}
                </select>
                {filteredCreditStudents.length === 0 && (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Aucun élève trouvé pour cette recherche.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Type
                </label>
                <select
                  value={creditForm.type}
                  onChange={(e) => setCreditForm({ ...creditForm, type: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                >
                  <option value="PREPAYMENT">Pré-paiement (crédit du solde)</option>
                  <option value="ADJUSTMENT">Ajustement (correction manuelle)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Montant (DT)
                </label>
                <input
                  type="number"
                  value={creditForm.amount || ""}
                  onChange={(e) => setCreditForm({ ...creditForm, amount: Number(e.target.value) })}
                  min={0}
                  step="0.01"
                  required
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                />
              </div>

              {creditForm.type === "ADJUSTMENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Sens
                  </label>
                  <select
                    value={creditForm.credit ? "credit" : "debit"}
                    onChange={(e) => setCreditForm({ ...creditForm, credit: e.target.value === "credit" })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                  >
                    <option value="credit">Crédit (+ augmente le solde)</option>
                    <option value="debit">Débit (− diminue le solde)</option>
                  </select>
                </div>
              )}

              {creditForm.type === "PREPAYMENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Groupe
                  </label>
                  {(() => {
                    const groups = creditStudentGroups(creditForm.studentId);
                    if (groups.length === 0) {
                      return (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Aucun groupe actif pour cet élève — le crédit sera enregistré sur son solde
                          sans attribution à un groupe ni à un professeur.
                        </p>
                      );
                    }
                    return (
                      <select
                        value={creditForm.groupeId}
                        onChange={(e) =>
                          setCreditForm({ ...creditForm, groupeId: e.target.value })
                        }
                        className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Sélectionner un groupe</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.matiere ? `${g.matiere} — ` : ""}
                            {g.nom}
                            {g.prixParSeance ? ` (${g.prixParSeance} DT)` : ""}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              )}

              {creditForm.type === "PREPAYMENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Méthode de paiement
                  </label>
                  <select
                    value={creditForm.paymentMethod}
                    onChange={(e) => setCreditForm({ ...creditForm, paymentMethod: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                  >
                    <option value="especes">Espèces</option>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={creditForm.date}
                    onChange={(e) => setCreditForm({ ...creditForm, date: e.target.value })}
                    required
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Heure
                  </label>
                  <input
                    type="time"
                    value={creditForm.time}
                    onChange={(e) => setCreditForm({ ...creditForm, time: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Notes
                </label>
                <textarea
                  value={creditForm.notes}
                  onChange={(e) => setCreditForm({ ...creditForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Optionnel (ex : Paiement anticipé de plusieurs mois)"
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                />
              </div>

              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creditSubmitting || creditForm.amount <= 0 || !creditForm.studentId}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creditSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetail && detailTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-0 shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Détails de la transaction
              </h2>
              <button
                onClick={() => setShowDetail(false)}
                className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Type</span>
                <span className="font-medium">{TYPE_LABEL[detailTx.type] || detailTx.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Date</span>
                <span className="font-medium">{formatDate(detailTx.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Montant</span>
                <span
                  className={`font-semibold ${
                    detailTx.signedAmount >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {detailTx.signedAmount >= 0 ? "+" : ""}
                  {formatCurrency(detailTx.signedAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Description</span>
                <span className="max-w-[60%] text-right font-medium">{detailTx.description || "—"}</span>
              </div>
              {detailTx.attendance && (
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Cours lié</span>
                  <span className="max-w-[60%] text-right font-medium">
                    {detailTx.attendance.seance.groupe.nom}
                    {detailTx.attendance.seance.groupe.matiere?.nom
                      ? ` — ${detailTx.attendance.seance.groupe.matiere.nom}`
                      : ""}
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDate(detailTx.attendance.seance.date)}
                    </span>
                  </span>
                </div>
              )}
              {detailTx.paymentMethod && (
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Méthode</span>
                  <span className="font-medium">
                    {METHODE_LABEL[detailTx.paymentMethod] || detailTx.paymentMethod}
                  </span>
                </div>
              )}
              {detailTx.receiptNumber && (
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Reçu</span>
                  <span className="font-mono font-medium">{detailTx.receiptNumber}</span>
                </div>
              )}
              {detailTx.reference && (
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Référence</span>
                  <span className="max-w-[60%] truncate font-mono font-medium">{detailTx.reference}</span>
                </div>
              )}
              {detailTx.reversalOf && (
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Annule</span>
                  <span className="font-medium">
                    {detailTx.reversalOf.receiptNumber
                      ? detailTx.reversalOf.receiptNumber
                      : detailTx.reversalOf.id.slice(0, 8)}
                  </span>
                </div>
              )}
              {detailTx.notes && (
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">Notes</span>
                  <span className="max-w-[60%] text-right font-medium">{detailTx.notes}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Créée le</span>
                <span className="font-medium">{new Date(detailTx.createdAt).toLocaleString("fr-FR")}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end border-t border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <button
                onClick={() => openReceipt(detailTx)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
              >
                <FileText className="h-4 w-4" />
                Reçu
              </button>
            </div>
          </div>
        </div>
      )}

      {showReverseModal && reverseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-0 shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Annuler la transaction
              </h2>
              <button
                onClick={() => setShowReverseModal(false)}
                className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3 text-sm">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {TYPE_LABEL[reverseTarget.type] || reverseTarget.type} —{" "}
                  {formatCurrency(Math.abs(reverseTarget.signedAmount))}
                </p>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{reverseTarget.description || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Raison de l&apos;annulation
                </label>
                <textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Ex : Erreur de saisie, annulation du paiement..."
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-neutral-100 px-6 py-4 dark:border-[#2a2d35]">
              <button
                onClick={() => setShowReverseModal(false)}
                className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
              >
                Retour
              </button>
              <button
                onClick={handleReverse}
                disabled={reversing || !reverseReason.trim()}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {reversing && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
