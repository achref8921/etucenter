"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Save, Users, Calendar, Edit3, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { SkeletonPage } from "@/components/ui/skeleton";

interface GroupeList {
  id: string;
  nom: string;
  prixParSeance: number;
  forfaitMontant: number | null;
  forfaitSeances: number | null;
  nombreEleves: number;
  nombreSeances: number;
}

interface GroupeDetail {
  id: string;
  nom: string;
  description: string | null;
  prixParSeance: number;
  forfaitMontant: number | null;
  forfaitSeances: number | null;
  capaciteMax: number;
  matiere: { id: string; nom: string } | null;
  inscriptions: { id: string; eleve: { id: string; nom: string; prenom: string; email: string } }[];
  seances: { id: string; date: string; statut: string; _count: { presences: number } }[];
}

export default function ProfGroupesPage() {
  const { toast } = useToast();
  const [groupes, setGroupes] = useState<GroupeList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupe, setGroupe] = useState<GroupeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editForfaitMontant, setEditForfaitMontant] = useState<number>(0);
  const [editForfaitSeances, setEditForfaitSeances] = useState<number>(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [editingDetail, setEditingDetail] = useState(false);
  const [detailForm, setDetailForm] = useState({
    nom: "",
    description: "",
    capaciteMax: 0,
    tarifMode: "fixe" as "fixe" | "forfait",
    prixParSeance: 0,
    forfaitMontant: 0,
    forfaitSeances: 0,
  });
  const [savingDetail, setSavingDetail] = useState(false);


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
    const target = groupes.find((g) => g.id === id);
    const isForfait = !!target?.forfaitMontant && !!target?.forfaitSeances;
    if (isForfait) {
      if (editForfaitMontant <= 0 || editForfaitSeances <= 0) {
        setError("Le montant et le nombre de séances du forfait doivent être positifs");
        return;
      }
    } else if (editPrice < 0) {
      return;
    }
    try {
      setSavingId(id);
      setError(null);
      const res = await fetch(`/api/prof/groupes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isForfait
            ? { forfaitMontant: editForfaitMontant, forfaitSeances: editForfaitSeances }
            : { prixParSeance: editPrice }
        ),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      setEditingId(null);
      toast("success", "Tarif du groupe mis à jour");
      fetchGroupes();
      if (selectedId === id) fetchDetail(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      toast("error", msg);
    } finally {
      setSavingId(null);
    }
  };

  const startEditDetail = () => {
    if (!groupe) return;
    const hasForfait = !!groupe.forfaitMontant && !!groupe.forfaitSeances;
    setDetailForm({
      nom: groupe.nom,
      description: groupe.description ?? "",
      capaciteMax: groupe.capaciteMax,
      tarifMode: hasForfait ? "forfait" : "fixe",
      prixParSeance: groupe.prixParSeance,
      forfaitMontant: groupe.forfaitMontant ?? 0,
      forfaitSeances: groupe.forfaitSeances ?? 0,
    });
    setEditingDetail(true);
  };

  const handleSaveDetail = async () => {
    if (!groupe) return;
    if (!detailForm.nom.trim()) {
      setError("Le nom du groupe est requis");
      return;
    }
    const payload: Record<string, unknown> = {
      nom: detailForm.nom,
      description: detailForm.description || null,
      capaciteMax: detailForm.capaciteMax,
    };
    if (detailForm.tarifMode === "forfait") {
      if (detailForm.forfaitMontant <= 0 || detailForm.forfaitSeances <= 0) {
        setError("Le montant et le nombre de séances du forfait doivent être positifs");
        return;
      }
      payload.forfaitMontant = detailForm.forfaitMontant;
      payload.forfaitSeances = detailForm.forfaitSeances;
    } else {
      payload.prixParSeance = detailForm.prixParSeance;
    }
    try {
      setSavingDetail(true);
      setError(null);
      const res = await fetch(`/api/prof/groupes/${groupe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      setEditingDetail(false);
      toast("success", "Groupe mis à jour avec succès");
      fetchGroupes();
      fetchDetail(groupe.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      toast("error", msg);
    } finally {
      setSavingDetail(false);
    }
  };

  const afficherTarif = (g: { prixParSeance: number; forfaitMontant: number | null; forfaitSeances: number | null }) =>
    g.forfaitMontant && g.forfaitSeances
      ? `${formatCurrency(g.forfaitMontant)} / ${g.forfaitSeances} séances`
      : formatCurrency(g.prixParSeance);

  if (loading) {
    return <SkeletonPage />;
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
              {groupes.map((g) => {
                const hasForfait = !!g.forfaitMontant && !!g.forfaitSeances;
                return (
                <tr key={g.id} className={`transition-colors duration-150 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 ${selectedId === g.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
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
                      hasForfait ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={editForfaitMontant || ""}
                            onChange={(e) => setEditForfaitMontant(Number(e.target.value))}
                            className="w-20 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">DT</span>
                          <span className="text-xs text-gray-400">/</span>
                          <input
                            type="number"
                            min={1}
                            value={editForfaitSeances || ""}
                            onChange={(e) => setEditForfaitSeances(Number(e.target.value))}
                            className="w-14 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">séances</span>
                        </div>
                      ) : (
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
                      )
                    ) : (
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{afficherTarif(g)}</span>
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
                        onClick={() => {
                          setEditingId(g.id);
                          setEditPrice(g.prixParSeance);
                          setEditForfaitMontant(g.forfaitMontant ?? 0);
                          setEditForfaitSeances(g.forfaitSeances ?? 0);
                        }}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-3 w-3" /> Modifier
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
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
              <div className="flex items-center gap-2">
                {!editingDetail ? (
                  <button
                    onClick={startEditDetail}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Modifier
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveDetail}
                      disabled={savingDetail}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {savingDetail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setEditingDetail(false)}
                      className="rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <Link
                  href={`/prof/seances?groupeId=${groupe.id}`}
                  className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
                >
                  <Calendar className="h-3.5 w-3.5" /> Creer une seance
                </Link>
              </div>
            </div>
            {editingDetail ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Nom du groupe</label>
                    <input
                      type="text"
                      value={detailForm.nom}
                      onChange={(e) => setDetailForm({ ...detailForm, nom: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Capacité maximale</label>
                    <input
                      type="number"
                      min={0}
                      value={detailForm.capaciteMax || ""}
                      onChange={(e) => setDetailForm({ ...detailForm, capaciteMax: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Type de tarif</label>
                    <div className="flex rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDetailForm({ ...detailForm, tarifMode: "fixe" })}
                        className={`flex-1 px-3 py-2 text-xs font-medium ${
                          detailForm.tarifMode === "fixe"
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        Prix / séance
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailForm({ ...detailForm, tarifMode: "forfait" })}
                        className={`flex-1 px-3 py-2 text-xs font-medium ${
                          detailForm.tarifMode === "forfait"
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        Forfait (X DT / N séances)
                      </button>
                    </div>
                  </div>
                  {detailForm.tarifMode === "forfait" ? (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Tarif par forfait (ex. 110 DT pour 6 séances)
                      </label>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={detailForm.forfaitMontant || ""}
                            onChange={(e) => setDetailForm({ ...detailForm, forfaitMontant: Number(e.target.value) })}
                            placeholder="Montant (DT)"
                            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <span className="pb-2 text-sm text-gray-500 dark:text-gray-400">DT pour</span>
                        <div className="w-24">
                          <input
                            type="number"
                            min={1}
                            value={detailForm.forfaitSeances || ""}
                            onChange={(e) => setDetailForm({ ...detailForm, forfaitSeances: Number(e.target.value) })}
                            placeholder="N"
                            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <span className="pb-2 text-sm text-gray-500 dark:text-gray-400">séances</span>
                        {detailForm.forfaitMontant > 0 && detailForm.forfaitSeances > 0 && (
                          <div className="pb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                            = {formatCurrency(Math.round((detailForm.forfaitMontant / detailForm.forfaitSeances) * 100) / 100)} / séance
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Prix / séance (DT)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={detailForm.prixParSeance || ""}
                        onChange={(e) => setDetailForm({ ...detailForm, prixParSeance: Number(e.target.value) })}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
                  <textarea
                    value={detailForm.description}
                    onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                {groupe.description && <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{groupe.description}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Matiere</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{groupe.matiere?.nom ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Capacite</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{groupe.capaciteMax}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Tarif</span>
                    <p className="font-bold text-blue-600 dark:text-blue-400">{afficherTarif(groupe)}</p>
                    {groupe.forfaitMontant && groupe.forfaitSeances && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">soit {formatCurrency(groupe.prixParSeance)} / séance</p>
                    )}
                  </div>
                </div>
              </>
            )}
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
