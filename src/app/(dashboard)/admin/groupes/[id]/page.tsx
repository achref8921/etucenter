"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Loader2, X, Search, Download } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

interface GroupeData {
  groupe: {
    id: string;
    nom: string;
    description: string | null;
    prixParSeance: number;
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
  annulee: "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-300",
};

export default function AdminGroupeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [groupe, setGroupe] = useState<GroupeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EleveSearch[]>([]);
  const [searching, setSearching] = useState(false);
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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await fetch(`/api/admin/utilisateurs`);
      if (res.ok) {
        const data = await res.json();
        const enrolledIds = groupe?.inscriptions.map((i) => i.eleve.id) || [];
        setSearchResults(
          data
            .filter((u: any) => u.role === "eleve")
            .filter((u: any) => !enrolledIds.includes(u.id))
            .filter((u: any) => `${u.prenom} ${u.nom}`.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
        );
      }
    } finally {
      setSearching(false);
    }
  };

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
      setSearchResults([]);
      fetchGroupe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setAddingId(null);
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
          <Link href="/admin/groupes" className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Détail Groupe</h1>
        </div>
        {error && <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}
      </div>
    );
  }

  const g = groupe.groupe;

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
      `Prix/Mois: ${g.prixParSeance} DT`,
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
        <Link href="/admin/groupes" className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{g.nom}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase text-gray-400 dark:text-slate-500">Informations</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Nom</span><span className="font-medium text-gray-900 dark:text-gray-100">{g.nom}</span></div>
            {g.description && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Description</span><span className="text-gray-900 dark:text-gray-100">{g.description}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Prof</span><span className="font-medium text-gray-900 dark:text-gray-100">{g.prof ? `${g.prof.prenom} ${g.prof.nom}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Matière</span><span className="font-medium text-gray-900 dark:text-gray-100">{g.matiere?.nom ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Prix/Mois</span><span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(g.prixParSeance)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Capacité max</span><span className="font-medium text-gray-900 dark:text-gray-100">{g.capaciteMax}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase text-gray-400 dark:text-slate-500">Résumé Financier</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Dû</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(groupe.financialSummary.totalDue)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Payé</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(groupe.financialSummary.totalPaid)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Impayé</p>
                <p className={`text-lg font-semibold ${groupe.financialSummary.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>{formatCurrency(groupe.financialSummary.unpaid)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Élèves Inscrits ({groupe.inscriptions.length})</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadExcel} disabled={groupe.inscriptions.length === 0} className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              <Users className="h-3.5 w-3.5" /> Ajouter un élève
            </button>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Nom</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prénom</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Présences</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Absences</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Dû</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Payé</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Impayé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {groupe.inscriptions.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Aucun élève inscrit</td></tr>
            ) : (
              groupe.inscriptions.map((ins) => (
                <tr key={ins.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 font-medium">
                    <Link href={`/admin/eleves/${ins.eleve.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{ins.eleve.nom}</Link>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{ins.eleve.prenom}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{ins.eleve.email}</td>
                  <td className="px-6 py-4 text-green-600 dark:text-green-400">{ins.stats.presencesCount}</td>
                  <td className="px-6 py-4 text-red-600 dark:text-red-400">{ins.stats.absencesCount}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatCurrency(ins.stats.totalDue)}</td>
                  <td className="px-6 py-4 text-green-600 dark:text-green-400">{formatCurrency(ins.stats.totalPaid)}</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${ins.stats.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>{formatCurrency(ins.stats.unpaid)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Séances</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Horaire</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Présences</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {groupe.seances.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Aucune séance</td></tr>
            ) : (
              groupe.seances.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(s.date)}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {s.heureDebut && s.heureFin
                      ? `${new Date(s.heureDebut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${new Date(s.heureFin).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[s.statut] || "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-300"}`}>
                      {statusLabels[s.statut] || s.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{s.stats.presentsCount}/{s.stats.totalEleves}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter un élève</h2>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(""); setSearchResults([]); }} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher un élève..."
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {searching ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
              ) : searchResults.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery.length < 2 ? "Tapez au moins 2 caractères" : "Aucun résultat"}
                </p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.prenom} {e.nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{e.email}</p>
                      </div>
                      <button onClick={() => handleAddEleve(e.id)} disabled={addingId === e.id} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
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
    </div>
  );
}
