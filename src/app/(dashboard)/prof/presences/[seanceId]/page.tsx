"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, AlertTriangle, CheckCheck, X, RotateCcw } from "lucide-react";
import Link from "next/link";
import { SkeletonPage } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

interface Presence {
  id: string | null;
  seanceId: string;
  eleveId: string;
  statut: "present" | "absent" | null;
  dateCreation: string | Date | null;
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
  const { toast } = useToast();

  const fetchPresences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/prof/presences?seanceId=${seanceId}&timezoneOffset=${new Date().getTimezoneOffset()}`
      );
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

  const markAll = (statut: "present" | "absent") => {
    setPresences((prev) => prev.map((p) => ({ ...p, statut })));
  };

  const clearAll = () => {
    setPresences((prev) => prev.map((p) => ({ ...p, statut: null })));
  };

  const presentCount = presences.filter((p) => p.statut === "present").length;
  const absentCount = presences.filter((p) => p.statut === "absent").length;
  const unmarkedCount = presences.length - presentCount - absentCount;
  const markedRatio = presences.length > 0 ? ((presentCount + absentCount) / presences.length) * 100 : 0;

  const handleSave = async () => {
    try {
      const marked = presences.filter((p) => p.statut !== null);
      if (marked.length === 0) {
        setError("Veuillez marquer au moins un élève (présent ou absent)");
        setSuccess(null);
        toast("error", "Veuillez marquer au moins un élève");
        return;
      }
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/prof/presences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seanceId,
          timezoneOffset: new Date().getTimezoneOffset(),
          presences: marked.map((p) => ({
            eleveId: p.eleveId,
            statut: p.statut as "present" | "absent",
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de l'enregistrement");
      }
      setSuccess("Présences enregistrées avec succès");
      toast("success", "Présences enregistrées avec succès");
      fetchPresences();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SkeletonPage />;
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
          Fenêtre de modification fermée — les présences ne peuvent être enregistrées ou modifiées que dans les 7 jours suivant la séance.
        </div>
      )}

      {presences.length > 0 && (
        <div className="animate-fade-in-up rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <CheckCheck className="h-3.5 w-3.5" /> {presentCount} présent{presentCount > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <X className="h-3.5 w-3.5" /> {absentCount} absent{absentCount > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                <RotateCcw className="h-3.5 w-3.5" /> {unmarkedCount} non marqué{unmarkedCount > 1 ? "s" : ""}
              </span>
              <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${markedRatio}%` }}
                />
              </div>
            </div>
            {!isLocked && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => markAll("present")}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Tout présent
                </button>
                <button
                  onClick={() => markAll("absent")}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                >
                  <X className="h-3.5 w-3.5" /> Tout absent
                </button>
                <button
                  onClick={clearAll}
                  disabled={presentCount + absentCount === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Effacer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {presences.length === 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-gray-400">
            Aucun élève inscrit dans ce groupe
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
                  <tr
                    key={presence.eleveId}
                    className={`transition-colors ${
                      presence.statut === "present"
                        ? "bg-green-50/60 dark:bg-green-900/10"
                        : presence.statut === "absent"
                          ? "bg-red-50/60 dark:bg-red-900/10"
                          : "hover:bg-gray-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <td className="px-6 py-4 font-medium">{presence.eleve.nom}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{presence.eleve.prenom}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{presence.eleve.email}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(presence.eleveId, "present")}
                        disabled={isLocked}
                        aria-label={`Marquer ${presence.eleve.prenom} présent`}
                        className={`h-5 w-5 rounded-full border-2 transition-all ${
                          presence.statut === "present"
                            ? "border-green-500 bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]"
                            : "border-gray-300 hover:border-green-500 dark:border-slate-600"
                        }`}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(presence.eleveId, "absent")}
                        disabled={isLocked}
                        aria-label={`Marquer ${presence.eleve.prenom} absent`}
                        className={`h-5 w-5 rounded-full border-2 transition-all ${
                          presence.statut === "absent"
                            ? "border-red-500 bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]"
                            : "border-gray-300 hover:border-red-500 dark:border-slate-600"
                        }`}
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
                        : presence.statut === "absent"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300"
                    }`}
                  >
                    {presence.statut === "present"
                      ? "Présent"
                      : presence.statut === "absent"
                        ? "Absent"
                        : "Non marqué"}
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
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer ({presentCount + absentCount})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
