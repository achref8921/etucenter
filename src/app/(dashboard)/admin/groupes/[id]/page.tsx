"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Users, Loader2, X, Search, Download, Trash2, CalendarPlus, CalendarRange, RotateCcw, Scissors } from "lucide-react";
import { MontantInput } from "@/components/montant-input";
import { formatDate, formatCurrency, formatTime, todayDateInputValue, RATTRAPAGE_DATE_FUTURE_MESSAGE } from "@/lib/utils";
import ConfirmDelete from "@/components/confirm-delete";
import TimeInput from "@/components/time-input";

interface GroupeData {
  groupe: {
    id: string;
    nom: string;
    description: string | null;
    prixParSeance: number;
    forfaitMontant: number | null;
    forfaitSeances: number | null;
    capaciteMax: number;
    statut: "actif" | "archive";
    prof: { id: string; nom: string; prenom: string } | null;
    matiere: { id: string; nom: string } | null;
  };
  inscriptions: {
    id: string;
    statut: string;
    inscriptionId: string;
    forfaitMontant: number | null;
    forfaitSeances: number | null;
    forfaitSetAt: string | null;
    eleve: { id: string; nom: string; prenom: string; email: string };
    stats: { presencesCount: number; absencesCount: number; totalDue: number; totalPaid: number; unpaid: number };
  }[];
  seances: {
    id: string;
    date: string;
    heureDebut: string | null;
    heureFin: string | null;
    statut: string;
    stats: { presentsCount: number; totalEleves: number };
  }[];
  financialSummary: { totalDue: number; totalPaid: number; unpaid: number };
  paiements: {
    id: string;
    date: string;
    montant: number;
    methodePaiement: string;
    reference: string | null;
    notes: string | null;
    collecteParProf: boolean;
    eleve: { id: string; nom: string; prenom: string };
    collectedBy: { id: string; nom: string; prenom: string } | null;
  }[];
  periodTotalPaid: number;
  hasRange: boolean;
  periode: { from: string | null; to: string | null };
}

interface EleveSearch {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  niveau: string | null;
  classe: string | null;
  filiere: string | null;
}

const niveauLabels: Record<string, string> = { primaire: "Primaire", college: "Collège", lycee: "Lycée" };

const classesByNiveau: Record<string, string[]> = {
  primaire: ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année", "6ème année"],
  college: ["7ème", "8ème", "9ème"],
  lycee: ["1ère", "2ème", "3ème", "Bac"],
};

const filiereLabels: Record<string, string> = {
  lettres: "Lettres",
  economique: "Économique",
  informatique: "Informatique",
  technique: "Technique",
  sciences: "Sciences",
  math: "Mathématiques",
};

const statusLabels: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};

const statusColors: Record<string, string> = {
  planifiee: "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300",
  en_cours: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300",
  terminee: "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300",
  annulee: "bg-neutral-100 dark:bg-[#1e2128] text-neutral-800 dark:text-neutral-300",
};

const methodeLabels: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  autre: "Autre",
};

export default function AdminGroupeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [groupe, setGroupe] = useState<GroupeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingSeanceId, setDeletingSeanceId] = useState<string | null>(null);
  const [confirmDeleteSeance, setConfirmDeleteSeance] = useState<string | null>(null);
  const [showRattrapageModal, setShowRattrapageModal] = useState(false);
  const [rattrapageEleve, setRattrapageEleve] = useState<{ id: string; prenom: string; nom: string } | null>(null);
  const [rattrapageDate, setRattrapageDate] = useState("");
  const [rattrapageHeureDebut, setRattrapageHeureDebut] = useState("");
  const [rattrapageHeureFin, setRattrapageHeureFin] = useState("");
  const [rattrapageNotes, setRattrapageNotes] = useState("");
  const [savingRattrapage, setSavingRattrapage] = useState(false);
  const [rattrapageError, setRattrapageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allStudents, setAllStudents] = useState<EleveSearch[]>([]);
  const [filterClasse, setFilterClasse] = useState("");
  const [filterFiliere, setFilterFiliere] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveEleve, setConfirmRemoveEleve] = useState<{ id: string; inscriptionId: string; name: string } | null>(null);
  const [forfaitModal, setForfaitModal] = useState<{ inscriptionId: string; eleveName: string } | null>(null);
  const [forfaitMontantVal, setForfaitMontantVal] = useState("");
  const [forfaitSeancesVal, setForfaitSeancesVal] = useState("");
  const [forfaitSaving, setForfaitSaving] = useState(false);
  const [forfaitError, setForfaitError] = useState<string | null>(null);
  const [showTarifModal, setShowTarifModal] = useState(false);
  const [savingTarif, setSavingTarif] = useState(false);
  const [tarifMode, setTarifMode] = useState<"forfait" | "fixe">("forfait");
  const [tarifMontant, setTarifMontant] = useState(0);
  const [tarifSeances, setTarifSeances] = useState(0);
  const [tarifPrixSeance, setTarifPrixSeance] = useState(0);

  const fetchGroupe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);
      const query = qs.toString();
      const res = await fetch(`/api/admin/groupes/${id}${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setGroupe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [id, fromDate, toDate]);

  useEffect(() => {
    fetchGroupe();
  }, [fetchGroupe]);

  useEffect(() => {
    if (showAddModal) {
      loadAllStudents();
      setSearchQuery("");
      setFilterClasse("");
      setFilterFiliere("");
    }
  }, [showAddModal]);

  const loadAllStudents = async () => {
    try {
      setLoadingStudents(true);
      const res = await fetch(`/api/admin/utilisateurs`);
      if (res.ok) {
        const data = await res.json();
        const enrolledIds = groupe?.inscriptions.map((i) => i.eleve.id) || [];
        setAllStudents(
          data
            .filter((u: any) => u.role === "eleve")
            .filter((u: any) => !enrolledIds.includes(u.id))
        );
      }
    } finally {
      setLoadingStudents(false);
    }
  };

  const filteredStudents = allStudents.filter((e) => {
    const matchSearch =
      searchQuery === "" ||
      `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClasse = filterClasse === "" || e.classe === filterClasse;
    const matchFiliere = filterFiliere === "" || e.filiere === filterFiliere;
    return matchSearch && matchClasse && matchFiliere;
  });

  const handleAddEleve = async (eleveId: string) => {
    try {
      setAddingId(eleveId);
      const res = await fetch(`/api/admin/inscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eleveId, groupeId: id }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'inscription");
      }
      setSearchQuery("");
      setFilterClasse("");
      setFilterFiliere("");
      loadAllStudents();
      fetchGroupe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setAddingId(null);
    }
  };

  const handleRemoveEleve = async (inscriptionId: string) => {
    try {
      setRemovingId(inscriptionId);
      setError(null);
      const res = await fetch(`/api/admin/inscriptions?id=${inscriptionId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la suppression");
      }
      setConfirmRemoveEleve(null);
      fetchGroupe();
      loadAllStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setRemovingId(null);
    }
  };

  const openForfaitModal = (ins: { id: string; forfaitMontant: number | null; forfaitSeances: number | null; eleve: { prenom: string; nom: string } }) => {
    setForfaitModal({ inscriptionId: ins.id, eleveName: `${ins.eleve.prenom} ${ins.eleve.nom}` });
    setForfaitMontantVal(ins.forfaitMontant != null ? String(ins.forfaitMontant) : "");
    setForfaitSeancesVal(ins.forfaitSeances != null ? String(ins.forfaitSeances) : "");
    setForfaitError(null);
  };

  const handleSaveForfait = async () => {
    if (!forfaitModal) return;
    try {
      setForfaitSaving(true);
      setForfaitError(null);
      const montantVal = forfaitMontantVal.trim();
      const seancesVal = forfaitSeancesVal.trim();
      const body =
        montantVal === "" || seancesVal === "" || Number(seancesVal) <= 0
          ? { id: forfaitModal.inscriptionId, forfaitMontant: null, forfaitSeances: null }
          : { id: forfaitModal.inscriptionId, forfaitMontant: parseFloat(montantVal), forfaitSeances: parseInt(seancesVal, 10) };
      const res = await fetch(`/api/admin/inscriptions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise à jour du forfait");
      }
      setForfaitModal(null);
      fetchGroupe();
    } catch (err) {
      setForfaitError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setForfaitSaving(false);
    }
  };

  const handleDeleteSeance = async (seanceId: string) => {
    try {
      setDeletingSeanceId(seanceId);
      setError(null);
      const res = await fetch(`/api/admin/seances/${seanceId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la suppression");
      }
      setConfirmDeleteSeance(null);
      fetchGroupe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setConfirmDeleteSeance(null);
    } finally {
      setDeletingSeanceId(null);
    }
  };

  const openRattrapageModal = (eleve: { id: string; prenom: string; nom: string }) => {
    setRattrapageEleve(eleve);
    setRattrapageDate("");
    setRattrapageHeureDebut("");
    setRattrapageHeureFin("");
    setRattrapageNotes("");
    setRattrapageError(null);
    setShowRattrapageModal(true);
  };

  const handleSaveRattrapage = async () => {
    if (!rattrapageEleve) return;
    if (!rattrapageDate) {
      setRattrapageError("La date est requise");
      return;
    }
    if (rattrapageDate > todayDateInputValue()) {
      setRattrapageError(RATTRAPAGE_DATE_FUTURE_MESSAGE);
      return;
    }
    if (!rattrapageHeureDebut) {
      setRattrapageError("L'heure de la séance est requise");
      return;
    }
    try {
      setSavingRattrapage(true);
      setRattrapageError(null);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/admin/seances/rattrapage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eleveId: rattrapageEleve.id,
          groupeId: id,
          date: rattrapageDate,
          heureDebut: rattrapageHeureDebut,
          heureFin: rattrapageHeureFin || undefined,
          notes: rattrapageNotes || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'ajout de la séance");
      }
      setShowRattrapageModal(false);
      setSuccess("Séance de rattrapage ajoutée : l'élève a été notifié et le montant a été déduit de son compte.");
      fetchGroupe();
    } catch (err) {
      setRattrapageError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingRattrapage(false);
    }
  };

  if (loading && !groupe) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !groupe) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Détail Groupe</h1>
        {error && <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}
      </div>
    );
  }

  const g = groupe.groupe;

  const computedTarifPrixSeance =
    tarifMode === "forfait" && tarifMontant > 0 && tarifSeances > 0
      ? Math.round((tarifMontant / tarifSeances) * 100) / 100
      : 0;

  const openTarifModal = () => {
    const hasForfait = !!g.forfaitMontant && !!g.forfaitSeances;
    setTarifMode(hasForfait ? "forfait" : "fixe");
    setTarifMontant(hasForfait ? Number(g.forfaitMontant) : 0);
    setTarifSeances(hasForfait ? Number(g.forfaitSeances) : 0);
    setTarifPrixSeance(Number(g.prixParSeance) || 0);
    setShowTarifModal(true);
  };

  const handleSaveTarif = async () => {
    try {
      setSavingTarif(true);
      setError(null);
      const body =
        tarifMode === "forfait"
          ? {
              id,
              forfaitMontant: tarifMontant,
              forfaitSeances: tarifSeances,
              prixParSeance: computedTarifPrixSeance,
            }
          : { id, prixParSeance: tarifPrixSeance };
      const res = await fetch("/api/admin/groupes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error || "Erreur lors de la mise à jour");
      }
      setShowTarifModal(false);
      fetchGroupe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingTarif(false);
    }
  };

  const handleDownloadExcel = () => {
    const headers = ["Nom", "Prénom", "Email", "Présences", "Absences", "Prix/séance (DT)", "Total Dû (DT)", "Total Payé (DT)", "Impayé (DT)"];
    const rows = groupe.inscriptions.map((ins) => [
      ins.eleve.nom,
      ins.eleve.prenom,
      ins.eleve.email,
      ins.stats.presencesCount,
      ins.stats.absencesCount,
      ins.forfaitMontant != null && ins.forfaitSeances ? (ins.forfaitMontant / ins.forfaitSeances).toFixed(2) : `défaut (${groupe.groupe.prixParSeance})`,
      ins.stats.totalDue.toFixed(2),
      ins.stats.totalPaid.toFixed(2),
      ins.stats.unpaid.toFixed(2),
    ]);

    const csvContent = [
      `Groupe: ${g.nom}`,
      `Prof: ${g.prof ? `${g.prof.prenom} ${g.prof.nom}` : "—"}`,
      `Matière: ${g.matiere?.nom ?? "—"}`,
      `Prix: ${g.forfaitMontant && g.forfaitSeances ? `${g.forfaitMontant} DT / ${g.forfaitSeances} séances` : `${g.prixParSeance} DT / séance`}`,
      `Période: ${groupe.hasRange ? `${groupe.periode.from ?? "…"} → ${groupe.periode.to ?? "…"}` : "depuis la création"}`,
      "",
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
      "",
      `Total Dû;${groupe.financialSummary.totalDue.toFixed(2)}`,
      `Total Payé;${groupe.financialSummary.totalPaid.toFixed(2)}`,
      `Impayé;${groupe.financialSummary.unpaid.toFixed(2)}`,
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `groupe_${g.nom.replace(/\s+/g, "_")}_eleves.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">{g.nom}</h1>
          {g.statut === "archive" && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Archivé
            </span>
          )}
        </div>
        {g.statut !== "archive" && (
          <Link
            href={`/admin/groupes/reorganiser?groupes=${g.id}&mode=split&parts=2`}
            prefetch={false}
            className="flex w-fit items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800"
            title="Scinder ce groupe, le fusionner avec un autre ou déplacer des élèves"
          >
            <Scissors className="h-4 w-4" />
            Scinder / Fusionner
          </Link>
        )}
      </div>

      {g.statut === "archive" && (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <p className="font-semibold">Ce groupe est archivé.</p>
          <p className="mt-1">
            Il a été vidé lors d&apos;une réorganisation : son historique (séances, présences,
            paiements) reste consultable ici et n&apos;a pas été modifié. Aucune inscription ni
            séance ne peut y être ajoutée.
          </p>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--foreground)]">
            <CalendarRange className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Période
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-medium text-[var(--foreground-faint)]">Du</label>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <label className="text-[12px] font-medium text-[var(--foreground-faint)]">Au</label>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Toute la période
            </button>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />}
          <span className="ml-auto text-[12px] text-[var(--foreground-faint)]">
            {groupe.hasRange
              ? `Filtré${groupe.periode.from ? ` du ${formatDate(groupe.periode.from)}` : ""}${groupe.periode.to ? ` au ${formatDate(groupe.periode.to)}` : ""}`
              : "Depuis la création du groupe"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Informations</h2>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between"><span className="text-[var(--foreground-faint)]">Nom</span><span className="font-medium text-[var(--foreground)]">{g.nom}</span></div>
            {g.description && <div className="flex justify-between"><span className="text-[var(--foreground-faint)]">Description</span><span className="text-[var(--foreground)]">{g.description}</span></div>}
            <div className="flex justify-between"><span className="text-[var(--foreground-faint)]">Prof</span><span className="font-medium text-[var(--foreground)]">{g.prof ? `${g.prof.prenom} ${g.prof.nom}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-[var(--foreground-faint)]">Matière</span><span className="font-medium text-[var(--foreground)]">{g.matiere?.nom ?? "—"}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--foreground-faint)]">Tarif du groupe (défaut)</span>
              <div className="flex items-center gap-2">
                {g.forfaitMontant && g.forfaitSeances ? (
                  <span className="text-right">
                    <span className="block font-medium text-[var(--foreground)]">
                      {formatCurrency(g.forfaitMontant)} / {g.forfaitSeances} séances
                    </span>
                    <span className="block text-[12px] text-[var(--foreground-faint)]">
                      {formatCurrency(g.prixParSeance)} / séance
                    </span>
                  </span>
                ) : (
                  <span className="font-medium text-[var(--foreground)]">{formatCurrency(g.prixParSeance)} / séance</span>
                )}
                <button onClick={openTarifModal} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-semibold text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]">
                  Modifier
                </button>
              </div>
            </div>
            <div className="flex justify-between"><span className="text-[var(--foreground-faint)]">Capacité max</span><span className="font-medium text-[var(--foreground)]">{g.capaciteMax}</span></div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Résumé Financier{groupe.hasRange ? " (période)" : ""}</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] bg-neutral-50 dark:bg-[#1e2128] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-[var(--foreground-subtle)]">Total Dû</p>
                <p className="text-lg font-semibold text-[var(--foreground)]">{formatCurrency(groupe.financialSummary.totalDue)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-neutral-50 dark:bg-[#1e2128] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-[var(--foreground-subtle)]">Total Payé</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(groupe.financialSummary.totalPaid)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-neutral-50 dark:bg-[#1e2128] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-[var(--foreground-subtle)]">Impayé</p>
                <p className={`text-lg font-semibold ${groupe.financialSummary.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"}`}>{formatCurrency(groupe.financialSummary.unpaid)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Élèves Inscrits ({groupe.inscriptions.length})</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadExcel} disabled={groupe.inscriptions.length === 0} className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128] disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
            <button onClick={() => setShowAddModal(true)} disabled={g.statut === "archive"} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" title={g.statut === "archive" ? "Groupe archivé : aucune inscription possible" : undefined}>
              <Users className="h-3.5 w-3.5" /> Ajouter un élève
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Nom</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Prénom</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Email</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Présences</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Absences</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Dû</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Payé</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Impayé</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {groupe.inscriptions.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-2.5 text-center text-[var(--foreground-faint)]">Aucun élève inscrit</td></tr>
            ) : (
              groupe.inscriptions.map((ins) => (
                <tr key={ins.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/eleves/${ins.eleve.id}`} prefetch={false} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{ins.eleve.nom}</Link>
                      <button
                        onClick={() => openForfaitModal(ins)}
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                          ins.forfaitMontant != null && ins.forfaitSeances
                            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-300"
                            : "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-[#2a2d35] dark:bg-[#1e2128] dark:text-neutral-400"
                        } hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-600 dark:hover:bg-[#1e2128]`}
                        title={ins.forfaitMontant != null && ins.forfaitSeances ? `Forfait : ${formatCurrency(ins.forfaitMontant)} / ${ins.forfaitSeances} séances` : "Forfait inactif — cliquer pour définir"}
                      >
                        Forfait
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground)]">{ins.eleve.prenom}</td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground)]">{ins.eleve.email}</td>
                  <td className="px-4 py-2.5 text-green-600 dark:text-green-400">{ins.stats.presencesCount}</td>
                  <td className="px-4 py-2.5 text-red-600 dark:text-red-400">{ins.stats.absencesCount}</td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground)]">{formatCurrency(ins.stats.totalDue)}</td>
                  <td className="px-4 py-2.5 text-green-600 dark:text-green-400">{formatCurrency(ins.stats.totalPaid)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium ${ins.stats.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"}`}>{formatCurrency(ins.stats.unpaid)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openRattrapageModal(ins.eleve)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[12px] font-semibold text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                        title="Ajouter une séance passée"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" /> Séance passée
                      </button>
                      <button
                        onClick={() => setConfirmRemoveEleve({ id: ins.eleve.id, inscriptionId: ins.id, name: `${ins.eleve.prenom} ${ins.eleve.nom}` })}
                        disabled={removingId === ins.id}
                        className="rounded p-1 text-[var(--foreground-faint)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-30"
                        title="Retirer du groupe"
                      >
                        {removingId === ins.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="border-b border-[var(--border)] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Séances</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Date</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Horaire</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Statut</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Présences</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {groupe.seances.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-2.5 text-center text-[var(--foreground-faint)]">Aucune séance</td></tr>
            ) : (
              groupe.seances.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground)]">{formatDate(s.date)}</td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground)]">
                    {s.heureDebut && s.heureFin
                      ? `${formatTime(s.heureDebut)} - ${formatTime(s.heureFin)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[s.statut] || "bg-neutral-100 dark:bg-[#1e2128] text-neutral-800 dark:text-neutral-300"}`}>
                      {statusLabels[s.statut] || s.statut}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground)]">{s.stats.presentsCount}/{s.stats.totalEleves}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setConfirmDeleteSeance(s.id)}
                      disabled={deletingSeanceId === s.id || s.stats.totalEleves > 0}
                      className="rounded p-1 text-[var(--foreground-faint)] hover:bg-neutral-100 dark:hover:bg-[#1e2128] hover:text-red-600 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                      title={s.stats.totalEleves > 0 ? "Des présences sont enregistrées — suppression impossible" : "Supprimer"}
                    >
                      {deletingSeanceId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Paiements{groupe.hasRange ? " (période)" : ""} ({groupe.paiements.length})</h2>
          <span className="text-[13px] font-semibold text-green-600 dark:text-green-400">Total : {formatCurrency(groupe.periodTotalPaid)}</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Date</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Élève</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Montant</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Méthode</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] px-4 py-2.5">Encaissé par</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {groupe.paiements.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-2.5 text-center text-[var(--foreground-faint)]">Aucun paiement{groupe.hasRange ? " sur la période" : ""}</td></tr>
            ) : (
              groupe.paiements.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground)]">{formatDate(p.date)}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/eleves/${p.eleve.id}`} prefetch={false} className="text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline">{p.eleve.prenom} {p.eleve.nom}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-green-600 dark:text-green-400">{formatCurrency(p.montant)}</td>
                  <td className="px-4 py-2.5 text-[13px] text-[var(--foreground-subtle)]">{methodeLabels[p.methodePaiement] ?? p.methodePaiement}</td>
                  <td className="px-4 py-2.5 text-[13px]">
                    {p.collecteParProf ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                        Prof — {p.collectedBy ? `${p.collectedBy.prenom} ${p.collectedBy.nom}` : "—"}
                      </span>
                    ) : (
                      <span className="text-[var(--foreground-faint)]">Centre</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showTarifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tarif du groupe (tous les élèves)</h2>
              <button onClick={() => setShowTarifModal(false)} className="text-[var(--foreground-faint)] hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setTarifMode("forfait")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${tarifMode === "forfait" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "border-neutral-200 dark:border-[#2a2d35] text-neutral-600 dark:text-neutral-400"}`}
                >
                  Forfait (110 DT / N séances)
                </button>
                <button
                  onClick={() => setTarifMode("fixe")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${tarifMode === "fixe" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "border-neutral-200 dark:border-[#2a2d35] text-neutral-600 dark:text-neutral-400"}`}
                >
                  Prix fixe / séance
                </button>
              </div>

              {tarifMode === "forfait" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Montant (DT)</label>
                      <MontantInput
                        value={tarifMontant || ""}
                        onChange={setTarifMontant}
                        min={0}
                        placeholder="110"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Nombre de séances</label>
                      <input
                        type="number"
                        value={tarifSeances || ""}
                        onChange={(e) => setTarifSeances(Number(e.target.value))}
                        min={0}
                        placeholder="5"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {computedTarifPrixSeance > 0 && (
                    <p className="text-[13px] text-blue-600 dark:text-blue-400">
                      = {computedTarifPrixSeance.toFixed(2)} DT / séance
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--foreground-faint)]">
                    Le prix par séance sera calculé automatiquement (montant ÷ nombre de séances) et appliqué aux futurs calculs du groupe.
                  </p>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Prix / séance (DT)</label>
                  <MontantInput
                    value={tarifPrixSeance || ""}
                    onChange={setTarifPrixSeance}
                    min={0}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTarifModal(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveTarif}
                  disabled={savingTarif || (tarifMode === "forfait" && computedTarifPrixSeance <= 0) || (tarifMode === "fixe" && tarifPrixSeance <= 0)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingTarif && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {forfaitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setForfaitModal(null)}>
          <div className="w-full max-w-sm rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Forfait individuel</h2>
              <button onClick={() => setForfaitModal(null)} className="text-[var(--foreground-faint)] hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-[13px] text-[var(--foreground-subtle)]">
              Forfait pour <span className="font-semibold text-[var(--foreground)]">{forfaitModal.eleveName}</span>
            </p>
            <p className="mb-3 rounded-lg bg-neutral-50 dark:bg-[#1e2128] px-3 py-2 text-[12px] text-[var(--foreground-faint)]">
              Prix par défaut du groupe : <span className="font-medium text-[var(--foreground)]">{formatCurrency(groupe.groupe.prixParSeance)}</span> / séance
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Prix (DT)</label>
                <MontantInput
                  step="0.01"
                  min={0}
                  value={forfaitMontantVal ? parseFloat(forfaitMontantVal) || 0 : ""}
                  onChange={(v) => setForfaitMontantVal(v === 0 ? "" : String(v))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] dark:bg-[#1e2128] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder={`Ex : 110`}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Nombre de séances</label>
                <input
                  type="number"
                  min="1"
                  value={forfaitSeancesVal}
                  onChange={(e) => setForfaitSeancesVal(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] dark:bg-[#1e2128] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder={`Ex : 9`}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[var(--foreground-faint)]">
              Les montants déjà dus avant cette modification ne changent pas.
            </p>
            {forfaitError && (
              <p className="mt-2 text-[12px] text-red-600 dark:text-red-400">{forfaitError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setForfaitModal(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveForfait}
                disabled={forfaitSaving}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {forfaitSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {showRattrapageModal && rattrapageEleve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter une séance passée</h2>
              <button onClick={() => setShowRattrapageModal(false)} className="text-[var(--foreground-faint)] hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-3 text-[13px] text-blue-700 dark:text-blue-400">
              Élève : <strong>{rattrapageEleve.prenom} {rattrapageEleve.nom}</strong> — groupe « {g.nom} »
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Date</label>
                  <input
                    type="date"
                    value={rattrapageDate}
                    max={todayDateInputValue()}
                    onChange={(e) => setRattrapageDate(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-[11px] text-[var(--foreground-faint)]">
                    Date passée ou du jour uniquement.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Heure début</label>
                  <TimeInput value={rattrapageHeureDebut} onChange={setRattrapageHeureDebut} />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Heure fin</label>
                  <TimeInput value={rattrapageHeureFin} onChange={setRattrapageHeureFin} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Notes</label>
                <textarea
                  value={rattrapageNotes}
                  onChange={(e) => setRattrapageNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex. séance de rattrapage non saisie"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <p className="rounded-lg border border-[var(--border)] bg-neutral-50 dark:bg-[#1e2128] p-3 text-[13px] text-[var(--foreground-subtle)]">
                Le montant de <strong>{formatCurrency(g.prixParSeance)}</strong> sera déduit du compte de l'élève et une notification lui sera envoyée.
              </p>
              {rattrapageError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
                  {rattrapageError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRattrapageModal(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveRattrapage}
                  disabled={savingRattrapage}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingRattrapage && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ajouter et déduire
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter un élève</h2>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(""); setFilterClasse(""); setFilterFiliere(""); }} className="text-[var(--foreground-faint)] hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-faint)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou email..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] py-2 pl-10 pr-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="mb-3 flex gap-2">
              <select
                value={filterClasse}
                onChange={(e) => setFilterClasse(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Toutes les classes</option>
                {(["primaire", "college", "lycee"] as const).map((n) =>
                  (classesByNiveau[n] || []).map((c) => (
                    <option key={c} value={c}>{niveauLabels[n]} — {c}</option>
                  ))
                )}
              </select>
              <select
                value={filterFiliere}
                onChange={(e) => setFilterFiliere(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Toutes les filières</option>
                <option value="lettres">Lettres</option>
                <option value="economique">Économique</option>
                <option value="informatique">Informatique</option>
                <option value="technique">Technique</option>
                <option value="sciences">Sciences</option>
                <option value="math">Math</option>
              </select>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loadingStudents ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
              ) : filteredStudents.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-[var(--foreground-faint)]">Aucun élève disponible</p>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[var(--foreground)]">{e.prenom} {e.nom}</p>
                        <p className="text-[12px] text-[var(--foreground-faint)]">
                          {e.email}
                          {e.niveau && ` · ${niveauLabels[e.niveau] ?? e.niveau}${e.classe ? ` — ${e.classe}` : ""}`}
                          {e.filiere && ` (${filiereLabels[e.filiere] ?? e.filiere})`}
                        </p>
                      </div>
                      <button onClick={() => handleAddEleve(e.id)} disabled={addingId === e.id} className="ml-3 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {addingId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ajouter"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDelete
        open={!!confirmRemoveEleve}
        title="Retirer l'élève du groupe"
        message={`Êtes-vous sûr de vouloir retirer ${confirmRemoveEleve?.name || ""} de ce groupe ? Son inscription sera désactivée.`}
        onConfirm={() => { if (confirmRemoveEleve) handleRemoveEleve(confirmRemoveEleve.inscriptionId); }}
        onCancel={() => setConfirmRemoveEleve(null)}
        loading={removingId === confirmRemoveEleve?.inscriptionId}
      />
      <ConfirmDelete
        open={!!confirmDeleteSeance}
        title="Supprimer la séance"
        message="Êtes-vous sûr de vouloir supprimer cette séance ? Aucune présence n'est enregistrée. Cette action est irréversible."
        onConfirm={() => { if (confirmDeleteSeance) handleDeleteSeance(confirmDeleteSeance); }}
        onCancel={() => setConfirmDeleteSeance(null)}
        loading={deletingSeanceId === confirmDeleteSeance}
      />
    </div>
  );
}
