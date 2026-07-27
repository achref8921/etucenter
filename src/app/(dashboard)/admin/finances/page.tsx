"use client";

import { useEffect, useState } from "react";
import { DollarSign, AlertTriangle, TrendingUp, Loader2, Plus, X, Pencil, FileText } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";

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

  const [editModal, setEditModal] = useState(false);
  const [editPaiement, setEditPaiement] = useState<Paiement | null>(null);
  const [editMontant, setEditMontant] = useState<number>(0);
  const [editRaison, setEditRaison] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      fetchData();
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
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Finances</h1>
        <button
          onClick={openModal}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Enregistrer un paiement
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenus Totaux</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Payé</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(stats.totalPaid)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Impayés</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
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

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historique des Paiements</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Élève</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Montant</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Méthode</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {paiements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucune transaction trouvée
                </td>
              </tr>
            ) : (
              paiements.map((paiement) => (
                <tr key={paiement.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {formatDateTime(paiement.datePaiement)}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/eleves/${paiement.eleve.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {paiement.eleve.prenom} {paiement.eleve.nom}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{paiement.groupe.nom}</td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(paiement.montant)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded-full bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                      {paiement.methodePaiement}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => window.open(`/api/paiements/${paiement.id}/facture`, "_blank")}
                        className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Générer la facture"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(paiement)}
                        className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">Filtrer par classe</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <select
                      value={filterNiveau}
                      onChange={(e) => { setFilterNiveau(e.target.value); setFilterClasse(""); setFilterFiliere(""); setSelectedEleveId(""); setSelectedGroupeId(""); setMontant(0); }}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
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
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
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

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Élève
                  {filteredEleves.length > 0 && (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({filteredEleves.length})</span>
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
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="">Sélectionner un élève</option>
                  {filteredEleves.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.codeEleve ? `[${e.codeEleve}] ` : ""}{e.prenom} {e.nom}{e.classe ? ` — ${e.classe}` : ""}
                    </option>
                  ))}
                </select>
                {filteredEleves.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Aucun élève trouvé pour ce filtre.</p>
                )}
              </div>

              {selectedEleve && selectedEleve.groupes.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Groupe</label>
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
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Cet élève n&apos;est inscrit à aucun groupe.</p>
              )}

              {selectedGroupeData && (
                <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total dû</span>
                    <span className="font-medium">{formatCurrency(selectedGroupeData.totalDue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total payé</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(selectedGroupeData.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Impayé</span>
                    <span className={`font-medium ${selectedGroupeData.unpaid > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      {formatCurrency(selectedGroupeData.unpaid)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Montant (DT)</label>
                <input
                  type="number"
                  value={montant || ""}
                  onChange={(e) => setMontant(Number(e.target.value))}
                  min={0}
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Méthode de paiement</label>
                <select
                  value={methodePaiement}
                  onChange={(e) => setMethodePaiement(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="especes">Espèces</option>
                  <option value="virement">Virement</option>
                  <option value="cheque">Chèque</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Référence</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Numéro de référence (optionnel)"
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes (optionnel)"
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedEleveId || !selectedGroupeId || montant <= 0}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Modifier le paiement</h2>
              <button onClick={() => setEditModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-3 text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">{editPaiement.eleve.prenom} {editPaiement.eleve.nom}</span>
                {" — "}
                {editPaiement.groupe.nom}
              </p>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Montant actuel: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(editPaiement.montant)}</span>
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nouveau montant (DT)</label>
                <input
                  type="number"
                  value={editMontant || ""}
                  onChange={(e) => setEditMontant(Number(e.target.value))}
                  min={0}
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                {editMontant !== Number(editPaiement.montant) && (
                  <p className={`mt-1 text-xs ${editMontant > Number(editPaiement.montant) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {editMontant > Number(editPaiement.montant) ? "+" : ""}
                    {editMontant - Number(editPaiement.montant)} DT
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Raison de la modification <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editRaison}
                  onChange={(e) => setEditRaison(e.target.value)}
                  rows={3}
                  required
                  placeholder="Expliquez la raison de cette modification..."
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(false)}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || editMontant <= 0 || !editRaison.trim() || editMontant === Number(editPaiement.montant)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
