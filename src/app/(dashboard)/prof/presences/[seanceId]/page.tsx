"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Presence {
  id: string;
  seanceId: string;
  eleveId: string;
  statut: "present" | "absent";
  dateCreation: string | Date;
  eleve: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  };
}

export default function AttendanceRecordingPage() {
  const params = useParams();
  const seanceId = params.seanceId as string;

  const [presences, setPresences] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const fetchPresences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prof/presences?seanceId=${seanceId}`);
      if (!res.ok) throw new Error("Erreur lors du chargement des présences");
      const data = await res.json();
      setPresences(data.presences);
      setIsLocked(!data.canModify);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [seanceId]);

  useEffect(() => {
    fetchPresences();
  }, [fetchPresences]);

  const handleStatusChange = (eleveId: string, statut: "present" | "absent") => {
    setPresences((prev) =>
      prev.map((p) => (p.eleveId === eleveId ? { ...p, statut } : p))
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/prof/presences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seanceId,
          presences: presences.map((p) => ({
            eleveId: p.eleveId,
            statut: p.statut,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'enregistrement");
      }
      setSuccess("Présences enregistrées avec succès");
      fetchPresences();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
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
      <div className="flex items-center gap-4">
        <Link
          href="/prof/presences"
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Enregistrement des Présences</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 p-4 text-sm text-orange-700 dark:text-orange-400">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          Fenêtre de modification fermée — les présences ne peuvent être modifiées que pendant la séance et jusqu&apos;à 30 minutes après sa fin.
        </div>
      )}

      {presences.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-gray-400">
          Aucun élève trouvé pour cette séance
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Nom</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Prénom</th>
                  <th className="px-6 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Présent</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {presences.map((presence) => (
                  <tr key={presence.eleveId} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 font-medium">{presence.eleve.nom}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{presence.eleve.prenom}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{presence.eleve.email}</td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="radio"
                        name={`presence-${presence.eleveId}`}
                        checked={presence.statut === "present"}
                        onChange={() => handleStatusChange(presence.eleveId, "present")}
                        disabled={isLocked}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="radio"
                        name={`presence-${presence.eleveId}`}
                        checked={presence.statut === "absent"}
                        onChange={() => handleStatusChange(presence.eleveId, "absent")}
                        disabled={isLocked}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {presences.map((presence) => (
              <div key={presence.eleveId} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                      {presence.eleve.prenom} {presence.eleve.nom}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{presence.eleve.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      presence.statut === "present"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {presence.statut === "present" ? "Présent" : "Absent"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(presence.eleveId, "present")}
                    disabled={isLocked}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      presence.statut === "present"
                        ? "bg-green-600 text-white"
                        : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                    }`}
                  >
                    Présent
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(presence.eleveId, "absent")}
                    disabled={isLocked}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      presence.statut === "absent"
                        ? "bg-red-600 text-white"
                        : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                    }`}
                  >
                    Absent
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || isLocked}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
