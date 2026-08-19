"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Loader2, X, Search, Download, Trash2, CalendarPlus } from "lucide-react";
import { formatDate, formatCurrency, formatTime } from "@/lib/utils";
import ConfirmDelete from "@/components/confirm-delete";

interface GroupeData {
  groupe: {
    id: string;
    nom: string;
    description: string | null;
    prixParSeance: number;
    forfaitMontant: number | null;
    forfaitSeances: number | null;
    capaciteMax: number;
    prof: { id: string; nom: string; prenom: string } | null;
    matiere: { id: string; nom: string } | null;
  };
  inscriptions: {
    id: string;
    statut: string;
    inscriptionId: string;
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

export default function AdminGroupeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [groupe, setGroupe] = useState<GroupeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [showTarifModal, setShowTarifModal] = useState(false);
  const [savingTarif, setSavingTarif] = useState(false);
  const [tarifMode, setTarifMode] = useState<"forfait" | "fixe">("forfait");
  const [tarifMontant, setTarifMontant] = useState(0);
  const [tarifSeances, setTarifSeances] = useState(0);
  const [tarifPrixSeance, setTarifPrixSeance] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [allStudents, setAllStudents] = useState<EleveSearch[]>([]);
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterFiliere, setFilterFiliere] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const fetchGroupe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/groupes/${id}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setGroupe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroupe();
  }, [fetchGroupe]);

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
    const matchNiveau = filterNiveau === "" || e.niveau === filterNiveau;
    const matchFiliere = filterFiliere === "" || e.filiere === filterFiliere;
    return matchSearch && matchNiveau && matchFiliere;
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
      setFilterNiveau("");
      setFilterFiliere("");
      loadAllStudents();
      fetchGroupe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setAddingId(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !groupe) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/groupes" className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Détail Groupe</h1>
        </div>
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
    const headers = ["Nom", "Prénom", "Email", "Présences", "Absences", "Total Dû (DT)", "Total Payé (DT)", "Impayé (DT)"];
    const rows = groupe.inscriptions.map((ins) => [
      ins.eleve.nom,
      ins.eleve.prenom,
      ins.eleve.email,
      ins.stats.presencesCount,
      ins.stats.absencesCount,
      ins.stats.totalDue.toFixed(2),
      ins.stats.totalPaid.toFixed(2),
      ins.stats.unpaid.toFixed(2),
    ]);

    const csvContent = [
      `Groupe: ${g.nom}`,
      `Prof: ${g.prof ? `${g.prof.prenom} ${g.prof.nom}` : "—"}`,
      `Matière: ${g.matiere?.nom ?? "—"}`,
      `Prix: ${g.forfaitMontant && g.forfaitSeances ? `${g.forfaitMontant} DT / ${g.forfaitSeances} séances` : `${g.prixParSeance} DT / séance`}`,
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
      <div className="flex items-center gap-4">
        <Link href="/admin/groupes" className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{g.nom}</h1>
      </div>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Informations</h2>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Nom</span><span className="font-medium text-neutral-900 dark:text-neutral-100">{g.nom}</span></div>
            {g.description && <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Description</span><span className="text-neutral-900 dark:text-neutral-100">{g.description}</span></div>}
            <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Prof</span><span className="font-medium text-neutral-900 dark:text-neutral-100">{g.prof ? `${g.prof.prenom} ${g.prof.nom}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Matière</span><span className="font-medium text-neutral-900 dark:text-neutral-100">{g.matiere?.nom ?? "—"}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">Tarif</span>
              <div className="flex items-center gap-2">
                {g.forfaitMontant && g.forfaitSeances ? (
                  <span className="text-right">
                    <span className="block font-medium text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(g.forfaitMontant)} / {g.forfaitSeances} séances
                    </span>
                    <span className="block text-[12px] text-neutral-400 dark:text-neutral-500">
                      {formatCurrency(g.prixParSeance)} / séance
                    </span>
                  </span>
                ) : (
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatCurrency(g.prixParSeance)} / séance</span>
                )}
                <button onClick={openTarifModal} className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2.5 py-1 text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]">
                  Modifier
                </button>
              </div>
            </div>
            <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Capacité max</span><span className="font-medium text-neutral-900 dark:text-neutral-100">{g.capaciteMax}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Résumé Financier</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-neutral-600 dark:text-neutral-400">Total Dû</p>
                <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(groupe.financialSummary.totalDue)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-neutral-600 dark:text-neutral-400">Total Payé</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(groupe.financialSummary.totalPaid)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-neutral-600 dark:text-neutral-400">Impayé</p>
                <p className={`text-lg font-semibold ${groupe.financialSummary.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"}`}>{formatCurrency(groupe.financialSummary.unpaid)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#2a2d35] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Élèves Inscrits ({groupe.inscriptions.length})</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadExcel} disabled={groupe.inscriptions.length === 0} className="flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-3 py-1.5 text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128] disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700">
              <Users className="h-3.5 w-3.5" /> Ajouter un élève
            </button>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
            <tr>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Nom</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Prénom</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Email</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Présences</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Absences</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Dû</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Payé</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Impayé</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {groupe.inscriptions.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-2.5 text-center text-neutral-500 dark:text-neutral-400">Aucun élève inscrit</td></tr>
            ) : (
              groupe.inscriptions.map((ins) => (
                <tr key={ins.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/admin/eleves/${ins.eleve.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{ins.eleve.nom}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{ins.eleve.prenom}</td>
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{ins.eleve.email}</td>
                  <td className="px-4 py-2.5 text-green-600 dark:text-green-400">{ins.stats.presencesCount}</td>
                  <td className="px-4 py-2.5 text-red-600 dark:text-red-400">{ins.stats.absencesCount}</td>
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{formatCurrency(ins.stats.totalDue)}</td>
                  <td className="px-4 py-2.5 text-green-600 dark:text-green-400">{formatCurrency(ins.stats.totalPaid)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium ${ins.stats.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-neutral-100"}`}>{formatCurrency(ins.stats.unpaid)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => openRattrapageModal(ins.eleve)}
                      className="flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-2 py-1 text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                      title="Ajouter une séance passée"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Séance passée
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 dark:border-[#2a2d35] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Séances</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
            <tr>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Date</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Horaire</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Statut</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Présences</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {groupe.seances.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-2.5 text-center text-neutral-500 dark:text-neutral-400">Aucune séance</td></tr>
            ) : (
              groupe.seances.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{formatDate(s.date)}</td>
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">
                    {s.heureDebut && s.heureFin
                      ? `${formatTime(s.heureDebut)} - ${formatTime(s.heureFin)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[s.statut] || "bg-neutral-100 dark:bg-[#1e2128] text-neutral-800 dark:text-neutral-300"}`}>
                      {statusLabels[s.statut] || s.statut}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{s.stats.presentsCount}/{s.stats.totalEleves}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setConfirmDeleteSeance(s.id)}
                      disabled={deletingSeanceId === s.id || s.stats.totalEleves > 0}
                      className="rounded p-1 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#1e2128] hover:text-red-600 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
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

      {showTarifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Modifier le tarif</h2>
              <button onClick={() => setShowTarifModal(false)} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setTarifMode("forfait")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${
                    tarifMode === "forfait"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "border-neutral-200 dark:border-[#2a2d35] text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  Forfait (110 DT / N séances)
                </button>
                <button
                  onClick={() => setTarifMode("fixe")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${
                    tarifMode === "fixe"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "border-neutral-200 dark:border-[#2a2d35] text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  Prix fixe / séance
                </button>
              </div>

              {tarifMode === "forfait" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Montant (DT)</label>
                      <input
                        type="number"
                        value={tarifMontant || ""}
                        onChange={(e) => setTarifMontant(Number(e.target.value))}
                        min={0}
                        placeholder="110"
                        className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Nombre de séances</label>
                      <input
                        type="number"
                        value={tarifSeances || ""}
                        onChange={(e) => setTarifSeances(Number(e.target.value))}
                        min={0}
                        placeholder="5"
                        className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {computedTarifPrixSeance > 0 && (
                    <p className="text-[13px] text-blue-600 dark:text-blue-400">
                      = {computedTarifPrixSeance.toFixed(2)} DT / séance
                    </p>
                  )}
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Prix / séance (DT)</label>
                  <input
                    type="number"
                    value={tarifPrixSeance}
                    onChange={(e) => setTarifPrixSeance(Number(e.target.value))}
                    min={0}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTarifModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
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

      {showRattrapageModal && rattrapageEleve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter une séance passée</h2>
              <button onClick={() => setShowRattrapageModal(false)} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-3 text-[13px] text-blue-700 dark:text-blue-400">
              Élève : <strong>{rattrapageEleve.prenom} {rattrapageEleve.nom}</strong> — groupe « {g.nom} »
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Date</label>
                  <input
                    type="date"
                    value={rattrapageDate}
                    onChange={(e) => setRattrapageDate(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Heure début</label>
                  <input
                    type="time"
                    value={rattrapageHeureDebut}
                    onChange={(e) => setRattrapageHeureDebut(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Heure fin</label>
                  <input
                    type="time"
                    value={rattrapageHeureFin}
                    onChange={(e) => setRattrapageHeureFin(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Notes</label>
                <textarea
                  value={rattrapageNotes}
                  onChange={(e) => setRattrapageNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex. séance de rattrapage non saisie"
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <p className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3 text-[13px] text-neutral-600 dark:text-neutral-400">
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
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
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
          <div className="w-full max-w-lg rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter un élève</h2>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(""); setFilterNiveau(""); setFilterFiliere(""); }} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou email..."
                className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 py-2 pl-10 pr-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="mb-3 flex gap-2">
              <select
                value={filterNiveau}
                onChange={(e) => setFilterNiveau(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-3 py-2 text-[13px] text-neutral-900 dark:text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous les niveaux</option>
                <option value="primaire">Primaire</option>
                <option value="college">Collège</option>
                <option value="lycee">Lycée</option>
              </select>
              <select
                value={filterFiliere}
                onChange={(e) => setFilterFiliere(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-3 py-2 text-[13px] text-neutral-900 dark:text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <p className="py-4 text-center text-[13px] text-neutral-500 dark:text-neutral-400">Aucun élève disponible</p>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-[#2a2d35] p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">{e.prenom} {e.nom}</p>
                        <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                          {e.email}
                          {e.niveau && ` — ${e.niveau}`}
                          {e.classe && ` ${e.classe}`}
                          {e.filiere && ` (${e.filiere})`}
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
