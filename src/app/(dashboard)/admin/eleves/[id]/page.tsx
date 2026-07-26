"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Loader2 } from "lucide-react";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";

interface EleveData {
  eleve: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    dateNaissance: string | null;
    codeEleve: string | null;
    niveau: string | null;
    classe: string | null;
    filiere: string | null;
  };
  inscriptions: {
    id: string;
    groupe: { id: string; nom: string; matiere: { id: string; nom: string } | null; prof: { id: string; nom: string; prenom: string } | null };
    stats: { presencesCount: number; absencesCount: number; totalDue: number; totalPaid: number; unpaid: number };
  }[];
  paiements: {
    id: string;
    montant: number;
    datePaiement: string;
    methodePaiement: string;
    notes: string | null;
    groupe: { id: string; nom: string };
  }[];
}

export default function AdminEleveDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [eleve, setEleve] = useState<EleveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/eleves/${id}`);
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setEleve(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !eleve) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/utilisateurs"
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Détail Élève</h1>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  const e = eleve.eleve;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/utilisateurs"
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {e.prenom} {e.nom}
        </h1>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <User className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {e.prenom} {e.nom}
              </h2>
              {e.codeEleve && (
                <span className="inline-block rounded bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                  #{e.codeEleve}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{e.email}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Téléphone</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.telephone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Date de naissance</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {e.dateNaissance ? formatDate(e.dateNaissance) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Email</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Niveau</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {e.niveau === "primaire" ? "Primaire" : e.niveau === "college" ? "Collège" : e.niveau === "lycee" ? "Lycée" : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Classe</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.classe || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">Filière</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{e.filiere ? e.filiere.charAt(0).toUpperCase() + e.filiere.slice(1) : "—"}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Groupes Inscrits</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Matière</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prof</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Présences</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Absences</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Total Dû</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Total Payé</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Impayé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {eleve.inscriptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucun groupe inscrit
                </td>
              </tr>
            ) : (
              eleve.inscriptions.map((ins) => (
                <tr key={ins.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 font-medium">
                    <Link href={`/admin/groupes/${ins.groupe.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {ins.groupe.nom}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{ins.groupe.matiere?.nom ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {ins.groupe.prof
                      ? `${ins.groupe.prof.prenom} ${ins.groupe.prof.nom}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-green-600 dark:text-green-400">{ins.stats.presencesCount}</td>
                  <td className="px-6 py-4 text-red-600 dark:text-red-400">{ins.stats.absencesCount}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatCurrency(ins.stats.totalDue)}</td>
                  <td className="px-6 py-4 text-green-600 dark:text-green-400">{formatCurrency(ins.stats.totalPaid)}</td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${ins.stats.unpaid > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
                      {formatCurrency(ins.stats.unpaid)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historique des Paiements</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Groupe</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Montant</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Méthode</th>
              <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {eleve.paiements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucun paiement enregistré
                </td>
              </tr>
            ) : (
              eleve.paiements.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDateTime(p.datePaiement)}</td>
                  <td className="px-6 py-4 font-medium">{p.groupe.nom}</td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(p.montant)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded-full bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                      {p.methodePaiement}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{p.notes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
