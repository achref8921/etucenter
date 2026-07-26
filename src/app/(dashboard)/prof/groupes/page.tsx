"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Save, Users, Calendar, Edit3, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface GroupeList {
  id: string;
  nom: string;
  prixParSeance: number;
  nombreEleves: number;
  nombreSeances: number;
}

interface GroupeDetail {
  id: string;
  nom: string;
  description: string | null;
  prixParSeance: number;
  capaciteMax: number;
  matiere: { id: string; nom: string } | null;
  inscriptions: { id: string; eleve: { id: string; nom: string; prenom: string; email: string } }[];
  seances: { id: string; date: string; statut: string; _count: { presences: number } }[];
}

export default function ProfGroupesPage() {
  const [groupes, setGroupes] = useState<GroupeList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupe, setGroupe] = useState<GroupeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [savingId, setSavingId] = useState<string | null>(null);


  const fetchGroupes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/prof/groupes");
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setGroupes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/prof/groupes/${id}`);
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setGroupe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => { fetchGroupes(); }, [fetchGroupes]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); }, [selectedId, fetchDetail]);

  const handleSavePrice = async (id: string) => {
    if (editPrice < 0) return;
    try {
      setSavingId(id);
      setError(null);
      const res = await fetch(`/api/prof/groupes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prixParSeance: editPrice }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      setEditingId(null);
      fetchGroupes();
      if (selectedId === id) fetchDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingId(null);
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
      <div className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes Groupes</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prix par groupe — Modifiez le prix de chaque groupe individuellement</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Eleves</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Seances</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prix / Mois</th>
                <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {groupes.map((g) => (
                <tr key={g.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 ${selectedId === g.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedId(g.id)}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {g.nom}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{g.nombreEleves}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">                       {g.nombreSeances}</td>
                  <td className="px-6 py-4">
                    {editingId === g.id ? (

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          className="w-24 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">DT</span>
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(g.prixParSeance)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === g.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSavePrice(g.id)}
                          disabled={savingId === g.id}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {savingId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          OK
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-gray-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(g.id); setEditPrice(g.prixParSeance); }}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-3 w-3" /> Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {groupes.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Aucun groupe</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {groupe && selectedId && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{groupe.nom}</h2>
              <Link
                href={`/prof/seances?groupeId=${groupe.id}`}
                className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
              >
                <Calendar className="h-3.5 w-3.5" /> Creer une seance
              </Link>
            </div>
            {groupe.description && <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{groupe.description}</p>}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Matiere</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{groupe.matiere?.nom ?? "—"}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Capacite</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{groupe.capaciteMax}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Prix actuel</span>
                <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(groupe.prixParSeance)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase text-gray-400 dark:text-gray-500">
                <Users className="mr-1 inline h-4 w-4" /> Eleves ({groupe.inscriptions.length})
              </h3>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {groupe.inscriptions.length === 0 ? (
                  <p className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">Aucun eleve</p>
                ) : (
                  groupe.inscriptions.map((ins) => (
                    <div key={ins.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {ins.eleve.prenom[0]}{ins.eleve.nom[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ins.eleve.prenom} {ins.eleve.nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{ins.eleve.email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase text-gray-400 dark:text-gray-500">
                <Calendar className="mr-1 inline h-4 w-4" /> Dernieres seances
              </h3>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {groupe.seances.length === 0 ? (
                  <p className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">Aucune seance</p>
                ) : (
                  groupe.seances.slice(0, 8).map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{formatDate(s.date)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{s._count.presences} presences</span>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.statut === "terminee" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : s.statut === "planifiee" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}>
                          {s.statut === "terminee" ? "Terminee" : s.statut === "planifiee" ? "Planifiee" : "En cours"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
