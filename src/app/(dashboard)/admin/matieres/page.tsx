"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import ConfirmDelete from "@/components/confirm-delete";

interface Matiere {
  id: string;
  nom: string;
  description: string | null;
}

export default function MatieresPage() {
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);

  const fetchMatieres = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/matieres");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setMatieres(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatieres();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/admin/matieres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, description }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la création");
      }
      setShowModal(false);
      setNom("");
      setDescription("");
      fetchMatieres();
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
      const res = await fetch(`/api/admin/matieres?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la suppression");
      }
      fetchMatieres();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestion des Matières</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Nom</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {matieres.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucune matière trouvée
                  </td>
                </tr>
              ) : (
                matieres.map((matiere) => (
                  <tr key={matiere.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 font-medium">{matiere.nom}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{matiere.description || "—"}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setConfirmDelete({ id: matiere.id })}
                        disabled={deletingId === matiere.id}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingId === matiere.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter une matière</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDelete open={!!confirmDelete} title="Supprimer la matière" message="Êtes-vous sûr de vouloir supprimer cette matière ? Cette action est irréversible." onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete.id); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} loading={deletingId === confirmDelete?.id} />
    </div>
  );
}
