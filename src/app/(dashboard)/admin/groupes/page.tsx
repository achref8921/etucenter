"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, X, Loader2, Pencil, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import ConfirmDelete from "@/components/confirm-delete";

interface Groupe {
  id: string;
  nom: string;
  description: string | null;
  prixParSeance: number;
  forfaitMontant: number | null;
  forfaitSeances: number | null;
  capaciteMax: number;
  prof: { id: string; nom: string; prenom: string } | null;
  matiere: { id: string; nom: string } | null;
}

interface Prof {
  id: string;
  nom: string;
  prenom: string;
}

interface Matiere {
  id: string;
  nom: string;
}

interface GroupeFormData {
  nom: string;
  description: string;
  profId: string;
  matiereId: string;
  prixParSeance: number;
  forfaitMontant: number;
  forfaitSeances: number;
  capaciteMax: number;
}

export default function GroupesPage() {
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroupe, setEditingGroupe] = useState<Groupe | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProfId, setEditingProfId] = useState<string | null>(null);
  const [selectedProfId, setSelectedProfId] = useState<string>("");
  const [savingProfId, setSavingProfId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const [formData, setFormData] = useState<GroupeFormData>({
    nom: "",
    description: "",
    profId: "",
    matiereId: "",
    prixParSeance: 0,
    forfaitMontant: 0,
    forfaitSeances: 0,
    capaciteMax: 30,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [groupesRes, profsRes, matieresRes] = await Promise.all([
        fetch("/api/admin/groupes"),
        fetch("/api/admin/utilisateurs"),
        fetch("/api/admin/matieres"),
      ]);
      if (!groupesRes.ok) throw new Error("Erreur lors du chargement des groupes");
      const groupesData = await groupesRes.json();
      setGroupes(groupesData);
      if (profsRes.ok) {
        const usersData = await profsRes.json();
        setProfs(usersData.filter((u: { role: string }) => u.role === "prof" || u.role === "PROF"));
      }
      if (matieresRes.ok) {
        const matieresData = await matieresRes.json();
        setMatieres(matieresData);
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "forfaitMontant" || name === "forfaitSeances") {
      const num = Number(value);
      setFormData((prev) => {
        const next = { ...prev, [name]: num };
        if (next.forfaitMontant > 0 && next.forfaitSeances > 0) {
          next.prixParSeance =
            Math.round((next.forfaitMontant / next.forfaitSeances) * 100) / 100;
        }
        return next;
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: name === "prixParSeance" || name === "capaciteMax" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const isEditing = !!editingGroupe;
      const payload: Record<string, any> = {
        nom: formData.nom,
        description: formData.description,
        profId: formData.profId,
        matiereId: formData.matiereId,
        capaciteMax: formData.capaciteMax,
      };
      if (formData.forfaitMontant > 0 && formData.forfaitSeances > 0) {
        payload.forfaitMontant = formData.forfaitMontant;
        payload.forfaitSeances = formData.forfaitSeances;
        payload.prixParSeance =
          Math.round((formData.forfaitMontant / formData.forfaitSeances) * 100) / 100;
      } else {
        payload.prixParSeance = formData.prixParSeance;
      }
      if (isEditing) payload.id = editingGroupe.id;

      const res = await fetch("/api/admin/groupes", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || (isEditing ? "Erreur lors de la mise à jour" : "Erreur lors de la création"));
      }
      setShowModal(false);
      setEditingGroupe(null);
      setFormData({ nom: "", description: "", profId: "", matiereId: "", prixParSeance: 0, forfaitMontant: 0, forfaitSeances: 0, capaciteMax: 30 });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      setError(null);
      const res = await fetch(`/api/admin/groupes?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la suppression");
      }
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateProf = async (groupeId: string) => {
    try {
      setSavingProfId(groupeId);
      setError(null);
      const res = await fetch("/api/admin/groupes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: groupeId, profId: selectedProfId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la mise à jour");
      }
      setEditingProfId(null);
      setSelectedProfId("");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingProfId(null);
    }
  };

  const openCreate = () => {
    setEditingGroupe(null);
    setFormData({ nom: "", description: "", profId: "", matiereId: "", prixParSeance: 0, forfaitMontant: 0, forfaitSeances: 0, capaciteMax: 30 });
    setShowModal(true);
  };

  const openEdit = (groupe: Groupe) => {
    setEditingGroupe(groupe);
    setFormData({
      nom: groupe.nom,
      description: groupe.description || "",
      profId: groupe.prof?.id || "",
      matiereId: groupe.matiere?.id || "",
      prixParSeance: Number(groupe.prixParSeance) || 0,
      forfaitMontant: Number(groupe.forfaitMontant) || 0,
      forfaitSeances: Number(groupe.forfaitSeances) || 0,
      capaciteMax: Number(groupe.capaciteMax) || 30,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Gestion des Groupes</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Nom</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Prof</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Matière</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Prix</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {groupes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-center text-neutral-500 dark:text-neutral-400">
                    Aucun groupe trouvé
                  </td>
                </tr>
              ) : (
                groupes.map((groupe) => (
                  <tr key={groupe.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/admin/groupes/${groupe.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {groupe.nom}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">
                      {editingProfId === groupe.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={selectedProfId}
                            onChange={(e) => setSelectedProfId(e.target.value)}
                            className="rounded border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-2 py-1 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Aucun prof</option>
                            {profs.map((p) => (
                              <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                            ))}
                          </select>
                          <button onClick={() => handleUpdateProf(groupe.id)} disabled={savingProfId === groupe.id} className="text-green-600 dark:text-green-400 hover:text-green-800 disabled:opacity-50">
                            {savingProfId === groupe.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => { setEditingProfId(null); setSelectedProfId(""); }} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span>{groupe.prof ? `${groupe.prof.prenom} ${groupe.prof.nom}` : "—"}</span>
                          <button
                            onClick={() => { setEditingProfId(groupe.id); setSelectedProfId(groupe.prof?.id || ""); }}
                            className="text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Changer le prof"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">
                      {groupe.matiere?.nom || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">
                      {groupe.forfaitMontant && groupe.forfaitSeances ? (
                        <span className="flex flex-col">
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(groupe.forfaitMontant)} / {groupe.forfaitSeances} séances
                          </span>
                          <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                            {formatCurrency(groupe.prixParSeance)} / séance
                          </span>
                        </span>
                      ) : (
                        <span>{formatCurrency(groupe.prixParSeance)} / séance</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(groupe)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          title="Modifier le groupe"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: groupe.id })}
                          disabled={deletingId === groupe.id}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                        >
                          {deletingId === groupe.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingGroupe ? "Modifier le groupe" : "Ajouter un groupe"}</h2>
              <button
                onClick={() => { setShowModal(false); setEditingGroupe(null); }}
                className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Nom</label>
                <input
                  name="nom"
                  value={formData.nom}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Prof</label>
                <select
                  name="profId"
                  value={formData.profId}
                  onChange={handleChange}
                  required={!editingGroupe}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un prof</option>
                  {profs.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.prenom} {e.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Matière</label>
                <select
                  name="matiereId"
                  value={formData.matiereId}
                  onChange={handleChange}
                  required={!editingGroupe}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Sélectionner une matière</option>
                  {matieres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3">
                <p className="mb-2 text-[12px] font-semibold text-neutral-600 dark:text-neutral-300">
                  Tarif par forfait (ex. 110 DT pour 5 séances)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                      Montant du forfait (DT)
                    </label>
                    <input
                      name="forfaitMontant"
                      type="number"
                      value={formData.forfaitMontant || ""}
                      onChange={handleChange}
                      min={0}
                      placeholder="110"
                      className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                      Nombre de séances
                    </label>
                    <input
                      name="forfaitSeances"
                      type="number"
                      value={formData.forfaitSeances || ""}
                      onChange={handleChange}
                      min={0}
                      placeholder="5"
                      className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {formData.forfaitMontant > 0 && formData.forfaitSeances > 0 && (
                  <p className="mt-2 text-[13px] text-blue-600 dark:text-blue-400">
                    = {formData.prixParSeance.toFixed(2)} DT / séance
                  </p>
                )}
                <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
                  Prix par séance calculé automatiquement = montant ÷ nombre de séances
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Prix / séance (DT)
                </label>
                <input
                  name="prixParSeance"
                  type="number"
                  value={formData.prixParSeance}
                  onChange={handleChange}
                  required
                  min={0}
                  disabled={formData.forfaitMontant > 0 && formData.forfaitSeances > 0}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Capacité max
                </label>
                <input
                  name="capaciteMax"
                  type="number"
                  value={formData.capaciteMax}
                  onChange={handleChange}
                  required
                  min={1}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingGroupe(null); }}
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingGroupe ? "Enregistrer" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDelete open={!!confirmDelete} title="Supprimer le groupe" message="Êtes-vous sûr de vouloir supprimer ce groupe ? Cette action est irréversible." onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete.id); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} loading={deletingId === confirmDelete?.id} />
    </div>
  );
}
