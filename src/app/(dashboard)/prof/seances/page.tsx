"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Plus, X, Loader2, Pencil, Trash2, CalendarPlus } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import ConfirmDelete from "@/components/confirm-delete";

interface Seance {
  id: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  notes: string | null;
  groupe: { id: string; nom: string };
  _count: { presences: number };
}

interface Groupe {
  id: string;
  nom: string;
}

interface EleveOption {
  id: string;
  prenom: string;
  nom: string;
  email: string;
}

export default function ProfSeancesPage() {
  const router = useRouter();
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showRattrapageModal, setShowRattrapageModal] = useState(false);
  const [rattrapageGroupeId, setRattrapageGroupeId] = useState("");
  const [rattrapageEleves, setRattrapageEleves] = useState<EleveOption[]>([]);
  const [rattrapageEleveId, setRattrapageEleveId] = useState("");
  const [rattrapageDate, setRattrapageDate] = useState("");
  const [rattrapageHeureDebut, setRattrapageHeureDebut] = useState("");
  const [rattrapageHeureFin, setRattrapageHeureFin] = useState("");
  const [rattrapageNotes, setRattrapageNotes] = useState("");
  const [savingRattrapage, setSavingRattrapage] = useState(false);
  const [rattrapageError, setRattrapageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editSeance, setEditSeance] = useState<Seance | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHeureDebut, setEditHeureDebut] = useState("");
  const [editHeureFin, setEditHeureFin] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatut, setEditStatut] = useState("");

  const [createGroupeId, setCreateGroupeId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createHeureDebut, setCreateHeureDebut] = useState("");
  const [createHeureFin, setCreateHeureFin] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const fetchSeances = async (from?: string, to?: string) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      const res = await fetch(`/api/prof/seances?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur lors du chargement des séances");
      const data = await res.json();
      setSeances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupes = async () => {
    try {
      const res = await fetch("/api/prof/groupes");
      if (!res.ok) throw new Error("Erreur lors du chargement des groupes");
      const data = await res.json();
      setGroupes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  useEffect(() => {
    fetchSeances();
    fetchGroupes();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("creer=1")) {
      setShowCreateModal(true);
    }
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSeances(dateFrom || undefined, dateTo || undefined);
  };

  const toTimeInput = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };

  const toISODateTime = (date: string, time: string): string | null => {
    if (!time) return null;
    return `${date}T${time}:00.000Z`;
  };

  const openEditModal = (s: Seance, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditSeance(s);
    setEditDate(s.date.split("T")[0]);
    setEditHeureDebut(toTimeInput(s.heureDebut));
    setEditHeureFin(toTimeInput(s.heureFin));
    setEditNotes(s.notes || "");
    setEditStatut(s.statut);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSeance) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`/api/prof/seances/${editSeance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editDate,
          heureDebut: toISODateTime(editDate, editHeureDebut),
          heureFin: toISODateTime(editDate, editHeureFin),
          notes: editNotes || null,
          statut: editStatut,
          timezoneOffset: new Date().getTimezoneOffset(),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      setShowEditModal(false);
      fetchSeances(dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setDeletingId(id);
      setError(null);
      const res = await fetch(
        `/api/prof/seances/${id}?timezoneOffset=${new Date().getTimezoneOffset()}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      fetchSeances(dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!createGroupeId) newErrors.groupeId = "Requis";
    if (!createDate) newErrors.date = "Requis";
    if (Object.keys(newErrors).length > 0) { setCreateErrors(newErrors); return; }

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/prof/seances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupeId: createGroupeId,
          date: createDate,
          heureDebut: toISODateTime(createDate, createHeureDebut),
          heureFin: toISODateTime(createDate, createHeureFin),
          notes: createNotes || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      setShowCreateModal(false);
      setCreateGroupeId(""); setCreateDate(""); setCreateHeureDebut(""); setCreateHeureFin(""); setCreateNotes("");
      setCreateErrors({});
      fetchSeances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const loadGroupEleves = async (groupeId: string) => {
    setRattrapageEleves([]);
    setRattrapageEleveId("");
    if (!groupeId) return;
    try {
      const res = await fetch(`/api/prof/groupes/${groupeId}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      const data = await res.json();
      const eleves: EleveOption[] = (data.inscriptions || []).map((ins: any) => ins.eleve);
      setRattrapageEleves(eleves);
    } catch (err) {
      setRattrapageError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const openRattrapageModal = () => {
    setRattrapageGroupeId("");
    setRattrapageEleves([]);
    setRattrapageEleveId("");
    setRattrapageDate("");
    setRattrapageHeureDebut("");
    setRattrapageHeureFin("");
    setRattrapageNotes("");
    setRattrapageError(null);
    setSuccess(null);
    setShowRattrapageModal(true);
  };

  const handleSaveRattrapage = async () => {
    if (!rattrapageGroupeId) {
      setRattrapageError("Veuillez sélectionner un groupe");
      return;
    }
    if (!rattrapageEleveId) {
      setRattrapageError("Veuillez sélectionner un élève");
      return;
    }
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
          eleveId: rattrapageEleveId,
          groupeId: rattrapageGroupeId,
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
      fetchSeances(dateFrom || undefined, dateTo || undefined);
    } catch (err) {
      setRattrapageError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingRattrapage(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === "planifiee") return "Planifiée";
    if (s === "en_cours") return "En cours";
    if (s === "terminee") return "Terminée";
    return "Annulée";
  };

  const statusColor = (s: string) => {
    if (s === "planifiee") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (s === "en_cours") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    if (s === "terminee") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  const isSessionPast = (s: Seance): boolean => {
    const now = new Date();
    const dateStr = s.date.split("T")[0];
    let endDate: Date;
    if (s.heureFin) {
      const timePart = s.heureFin.includes("T") ? s.heureFin.split("T")[1] : s.heureFin;
      endDate = new Date(`${dateStr}T${timePart}`);
    } else {
      endDate = new Date(`${dateStr}T23:59:59Z`);
    }
    return now > endDate;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes Séances</h1>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreateGroupeId(""); setCreateDate(""); setCreateHeureDebut(""); setCreateHeureFin(""); setCreateNotes(""); setCreateErrors({}); }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle Séance
        </button>
        <button
          onClick={openRattrapageModal}
          className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          title="Ajouter une séance passée pour un élève"
        >
          <CalendarPlus className="h-4 w-4" />
          Séance passée
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400">{success}</div>
      )}

      <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date début</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date fin</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Filtrer</button>
        <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); fetchSeances(); }} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800">Réinitialiser</button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" /></div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Horaire</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Présences</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {seances.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Aucune séance trouvée</td></tr>
                ) : (
                  seances.map((seance) => (
                    <tr key={seance.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800" onClick={() => router.push(`/prof/presences/${seance.id}`)}>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(seance.date)}</td>
                      <td className="px-6 py-4 font-medium">{seance.groupe.nom}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {seance.heureDebut && seance.heureFin
                          ? `${formatTime(seance.heureDebut)} - ${formatTime(seance.heureFin)}`
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(seance.statut)}`}>
                          {statusLabel(seance.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{seance._count.presences}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => openEditModal(seance, e)}
                            disabled={isSessionPast(seance)}
                            className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            title={isSessionPast(seance) ? "Séance passée — modification impossible" : "Modifier"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(seance.id); }}
                            disabled={deletingId === seance.id}
                            className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            title="Supprimer"
                          >
                            {deletingId === seance.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
      )}

      {showRattrapageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-gray-100">Séance passée</h2>
              <button onClick={() => setShowRattrapageModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Groupe</label>
                <select
                  value={rattrapageGroupeId}
                  onChange={(e) => { setRattrapageGroupeId(e.target.value); loadGroupEleves(e.target.value); }}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un groupe</option>
                  {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Élève</label>
                <select
                  value={rattrapageEleveId}
                  onChange={(e) => setRattrapageEleveId(e.target.value)}
                  disabled={!rattrapageGroupeId}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">{rattrapageGroupeId ? "Sélectionner un élève" : "Choisissez d'abord un groupe"}</option>
                  {rattrapageEleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input
                  type="date"
                  value={rattrapageDate}
                  onChange={(e) => setRattrapageDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Heure début</label>
                  <input
                    type="time"
                    value={rattrapageHeureDebut}
                    onChange={(e) => setRattrapageHeureDebut(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Heure fin</label>
                  <input
                    type="time"
                    value={rattrapageHeureFin}
                    onChange={(e) => setRattrapageHeureFin(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={rattrapageNotes}
                  onChange={(e) => setRattrapageNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex. séance de rattrapage non saisie"
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {rattrapageError && (
                <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">{rattrapageError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRattrapageModal(false)}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveRattrapage}
                  disabled={savingRattrapage}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingRattrapage && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ajouter et déduire
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-gray-100">Nouvelle Séance</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Groupe</label>
                <select value={createGroupeId} onChange={(e) => setCreateGroupeId(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">Sélectionner un groupe</option>
                  {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select>
                {createErrors.groupeId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{createErrors.groupeId}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {createErrors.date && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{createErrors.date}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Heure début</label>
                  <input type="time" value={createHeureDebut} onChange={(e) => setCreateHeureDebut(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Heure fin</label>
                  <input type="time" value={createHeureFin} onChange={(e) => setCreateHeureFin(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800">Annuler</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editSeance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-gray-100">Modifier la Séance</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-3 text-sm text-gray-600 dark:text-gray-400">
              {editSeance.groupe.nom} — {formatDate(editSeance.date)}
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Heure début</label>
                  <input type="time" value={editHeureDebut} onChange={(e) => setEditHeureDebut(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Heure fin</label>
                  <input type="time" value={editHeureFin} onChange={(e) => setEditHeureFin(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Statut</label>
                <select value={editStatut} onChange={(e) => setEditStatut(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="planifiee">Planifiée</option>
                  <option value="en_cours">En cours</option>
                  <option value="terminee">Terminée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800">Annuler</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDelete
        open={!!confirmDelete}
        title="Supprimer la séance"
        message="Êtes-vous sûr de vouloir supprimer cette séance ? Les présences et les transactions financières liées seront également supprimées. Les élèves du groupe seront notifiés. Cette action est irréversible."
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
        loading={!!confirmDelete && deletingId === confirmDelete}
      />
    </div>
  );
}
