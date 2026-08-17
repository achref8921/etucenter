"use client";

import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { formatDate, formatTime, formatDateTime } from "@/lib/utils";

interface PresenceHistorique {
  id: string;
  statut: "present" | "absent";
  dateCreation: string;
  seance: {
    id: string;
    date: string;
    heureDebut: string | null;
    heureFin: string | null;
    statut: string;
    groupe: { id: string; nom: string };
  };
}

const seanceStatusColor = (s: string) => {
  if (s === "planifiee") return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
  if (s === "en_cours") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
  if (s === "terminee") return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
  return "bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-neutral-300";
};

const seanceStatusLabel = (s: string) => {
  if (s === "planifiee") return "Planifiée";
  if (s === "en_cours") return "En cours";
  if (s === "terminee") return "Terminée";
  return "Annulée";
};

export default function ElevePresencesPage() {
  const [presences, setPresences] = useState<PresenceHistorique[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PresenceHistorique | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/eleve/presences");
        if (!res.ok) throw new Error("Erreur lors du chargement des présences");
        const data = await res.json();
        setPresences(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalPresent = presences.filter((p) => p.statut === "present").length;
  const totalAbsent = presences.filter((p) => p.statut === "absent").length;
  const taux =
    presences.length > 0 ? Math.round((totalPresent / presences.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mes Présences</h1>
      </div>
      <p className="-mt-3 text-[13px] text-neutral-500 dark:text-neutral-400">
        Cliquez sur une ligne pour plus de détails.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {presences.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Total enregistré</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{presences.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Présences</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" /> {totalPresent}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">Taux de présence</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{taux}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div
                className={`h-full rounded-full ${
                  taux >= 80 ? "bg-emerald-500" : taux >= 60 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${taux}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Date</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Séance</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {presences.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
                    Aucun historique de présence
                  </td>
                </tr>
              ) : (
                presences.map((presence) => (
                  <tr
                    key={presence.id}
                    onClick={() => setSelected(presence)}
                    className="cursor-pointer transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                  >
                    <td className="px-4 py-2.5 text-[13px] text-neutral-600 dark:text-neutral-400">{formatDate(presence.seance.date)}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      {presence.seance.groupe.nom}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-600 dark:text-neutral-400">
                      {presence.seance.heureDebut && presence.seance.heureFin
                        ? `${formatTime(presence.seance.heureDebut)} - ${formatTime(presence.seance.heureFin)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          presence.statut === "present"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                      >
                        {presence.statut === "present" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {presence.statut === "present" ? "Présent" : "Absent"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ChevronDown className="ml-auto h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md overflow-hidden rounded-xl bg-white dark:bg-[#181b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex items-center justify-between px-6 py-4 ${
                selected.statut === "present" ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              <div className="flex items-center gap-3">
                {selected.statut === "present" ? (
                  <CheckCircle2 className="h-8 w-8 text-white" />
                ) : (
                  <XCircle className="h-8 w-8 text-white" />
                )}
                <div>
                  <p className="text-[13px] font-semibold text-white">
                    {selected.statut === "present" ? "Présence confirmée" : "Absence enregistrée"}
                  </p>
                  <p className="text-[12px] text-white/80">{selected.seance.groupe.nom}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg bg-white/20 p-1.5 text-white hover:bg-white/30">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 p-6 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Calendar className="h-4 w-4" /> Date
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(selected.seance.date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Clock className="h-4 w-4" /> Horaire
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {selected.seance.heureDebut && selected.seance.heureFin
                    ? `${formatTime(selected.seance.heureDebut)} - ${formatTime(selected.seance.heureFin)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Users className="h-4 w-4" /> Groupe
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{selected.seance.groupe.nom}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <ClipboardCheck className="h-4 w-4" /> État de la séance
                </span>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${seanceStatusColor(
                    selected.seance.statut
                  )}`}
                >
                  {seanceStatusLabel(selected.seance.statut)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Clock className="h-4 w-4" /> Enregistrée le
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(selected.dateCreation)}</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="mt-2 w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-[#1e2128]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
