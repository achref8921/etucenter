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
  Paperclip,
} from "lucide-react";
import { formatDate, formatTime, formatDateTime } from "@/lib/utils";
import SeanceDocumentsModal from "@/components/seance-documents-modal";
import SeanceFilesButton from "@/components/seance-files-button";
import { MetricCard } from "@/components/ui";

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
    documentCount: number;
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
  const [documentsSeance, setDocumentsSeance] = useState<{ id: string; label: string } | null>(null);

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
      <p className="-mt-3 text-[13px] text-[var(--foreground-faint)]">
        Cliquez sur une ligne pour plus de détails.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {presences.length > 0 && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-fade-in-up"
          style={{ animationDelay: "60ms" }}
        >
          <MetricCard
            label="Total enregistré"
            value={presences.length}
            currency={false}
            sub="séances suivies"
            icon={ClipboardCheck}
            tone="primary"
          />
          <MetricCard
            label="Présences"
            value={totalPresent}
            currency={false}
            sub={`${presences.length - totalPresent} absence(s)`}
            icon={CheckCircle2}
            tone="success"
          />
          <MetricCard
            label="Taux de présence"
            value={taux}
            currency={false}
            suffix="%"
            sub={taux >= 80 ? "excellent" : taux >= 60 ? "à améliorer" : "faible"}
            icon={Clock}
            tone={taux >= 80 ? "success" : taux >= 60 ? "warning" : "error"}
            ring={taux}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Date</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Groupe</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Séance</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {presences.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-[var(--foreground-faint)]">
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
                    <td className="px-4 py-2.5 text-[13px] text-[var(--foreground-subtle)]">{formatDate(presence.seance.date)}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      {presence.seance.groupe.nom}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-[var(--foreground-subtle)]">
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
                      <div className="flex items-center justify-end gap-1">
                        <SeanceFilesButton
                          count={presence.seance.documentCount}
                          compact
                          contextLabel={`Séance du ${formatDate(presence.seance.date)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocumentsSeance({
                              id: presence.seance.id,
                              label: `${presence.seance.groupe.nom} — ${formatDate(presence.seance.date)}`,
                            });
                          }}
                        />
                        <ChevronDown className="h-4 w-4 text-[var(--foreground-faint)]" />
                      </div>
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
            className="w-full max-w-md overflow-hidden rounded-xl bg-[var(--surface)]"
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
                <span className="flex items-center gap-2 text-[var(--foreground-faint)]">
                  <Calendar className="h-4 w-4" /> Date
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(selected.seance.date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--foreground-faint)]">
                  <Clock className="h-4 w-4" /> Horaire
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {selected.seance.heureDebut && selected.seance.heureFin
                    ? `${formatTime(selected.seance.heureDebut)} - ${formatTime(selected.seance.heureFin)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--foreground-faint)]">
                  <Users className="h-4 w-4" /> Groupe
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{selected.seance.groupe.nom}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--foreground-faint)]">
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
                <span className="flex items-center gap-2 text-[var(--foreground-faint)]">
                  <Clock className="h-4 w-4" /> Enregistrée le
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(selected.dateCreation)}</span>
              </div>
              <button
                onClick={() => {
                  setDocumentsSeance({
                    id: selected.seance.id,
                    label: `${selected.seance.groupe.nom} — ${formatDate(selected.seance.date)}`,
                  });
                  setSelected(null);
                }}
                className={
                  selected.seance.documentCount > 0
                    ? "mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700"
                    : "mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-[var(--surface-muted)]"
                }
              >
                <Paperclip className="h-4 w-4" />
                {selected.seance.documentCount > 0
                  ? `Ouvrir les supports (${selected.seance.documentCount})`
                  : "Aucun fichier — ajouter un support"}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-[#1e2128]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {documentsSeance && (
        <SeanceDocumentsModal
          seanceId={documentsSeance.id}
          seanceLabel={documentsSeance.label}
          role="eleve"
          onClose={() => setDocumentsSeance(null)}
        />
      )}
    </div>
  );
}
