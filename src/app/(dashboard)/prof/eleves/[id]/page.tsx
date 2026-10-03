"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Wallet,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import UserAvatar from "@/components/user-avatar";

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
    actif: boolean;
    createdAt: string;
    hasImage?: boolean;
  };
  inscriptions: {
    id: string;
    dateInscription: string;
    statut: string;
    forfaitMontant: number | null;
    forfaitSeances: number | null;
    groupe: {
      id: string;
      nom: string;
      prixParSeance: number | null;
      matiere: { id: string; nom: string } | null;
    };
    stats: {
      presencesCount: number;
      absencesCount: number;
      totalDue: number;
      totalPaid: number;
      unpaid: number;
    };
  }[];
  paiements: {
    id: string;
    montant: number;
    datePaiement: string;
    methodePaiement: string;
    notes: string | null;
    groupe: { id: string; nom: string };
  }[];
  presences: {
    id: string;
    statut: string;
    seance: {
      id: string;
      date: string;
      statut: string;
      groupe: {
        id: string;
        nom: string;
        matiere: { nom: string } | null;
      };
    };
  }[];
}

export default function ProfEleveDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<EleveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presenceFilter, setPresenceFilter] = useState<"toutes" | "present" | "absent">(
    "toutes"
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/prof/eleves/${id}`);
        if (res.status === 404) {
          setError("Élève introuvable ou non inscrit dans vos groupes.");
          return;
        }
        if (!res.ok) throw new Error("Erreur lors du chargement");
        setData(await res.json());
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link
          href="/prof/eleves"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error ?? "Élève introuvable."}
        </div>
      </div>
    );
  }

  const { eleve, inscriptions, paiements, presences } = data;

  const totaux = inscriptions.reduce(
    (acc, i) => ({
      due: acc.due + i.stats.totalDue,
      paid: acc.paid + i.stats.totalPaid,
      unpaid: acc.unpaid + i.stats.unpaid,
      presences: acc.presences + i.stats.presencesCount,
      absences: acc.absences + i.stats.absencesCount,
    }),
    { due: 0, paid: 0, unpaid: 0, presences: 0, absences: 0 }
  );

  const presencesFiltrees = presences.filter((p) => {
    if (presenceFilter === "present") return p.statut === "present";
    if (presenceFilter === "absent") return p.statut === "absent";
    return true;
  });

  const carte = "rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]";
  const cartePadding = "p-6";

  return (
    <div className="space-y-6">
      <Link
        href="/prof/eleves"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <ArrowLeft className="h-4 w-4" /> Retour à mes élèves
      </Link>

      {/* En-tête */}
      <div className={`${carte} ${cartePadding}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar
            userId={eleve.id}
            nom={eleve.nom}
            prenom={eleve.prenom}
            hasImage={eleve.hasImage}
            size="lg"
          />

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {eleve.prenom} {eleve.nom}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              {eleve.codeEleve && (
                <span className="font-mono">#{eleve.codeEleve}</span>
              )}
              {(eleve.niveau || eleve.classe) && (
                <span>
                  {eleve.niveau} {eleve.classe ? `— ${eleve.classe}` : ""}
                </span>
              )}
              {eleve.filiere && <span>{eleve.filiere}</span>}
              {eleve.dateNaissance && <span>Né(e) le {formatDate(eleve.dateNaissance)}</span>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {eleve.email && (
                <a
                  href={`mailto:${eleve.email}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                >
                  <Mail className="h-4 w-4" /> {eleve.email}
                </a>
              )}
              {eleve.telephone && (
                <a
                  href={`tel:${eleve.telephone}`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                >
                  <Phone className="h-4 w-4" /> {eleve.telephone}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Cette fiche est limitée à <strong>vos groupes</strong>. Les cours suivis avec
            d&apos;autres professeurs, ainsi que leurs données financières, ne sont pas
            affichés.
          </p>
        </div>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={carte}>
          <div className="p-5">
            <p className="text-xs font-medium uppercase text-neutral-400">Présences</p>
            <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totaux.presences}
            </p>
          </div>
        </div>
        <div className={carte}>
          <div className="p-5">
            <p className="text-xs font-medium uppercase text-neutral-400">Absences</p>
            <p className="mt-1.5 text-2xl font-bold text-red-600 dark:text-red-400">
              {totaux.absences}
            </p>
          </div>
        </div>
        <div className={carte}>
          <div className="p-5">
            <p className="text-xs font-medium uppercase text-neutral-400">Payé</p>
            <p className="mt-1.5 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(totaux.paid)}
            </p>
          </div>
        </div>
        <div className={carte}>
          <div className="p-5">
            <p className="text-xs font-medium uppercase text-neutral-400">Reste dû</p>
            <p
              className={`mt-1.5 text-2xl font-bold ${
                totaux.unpaid > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-neutral-900 dark:text-neutral-100"
              }`}
            >
              {formatCurrency(totaux.unpaid)}
            </p>
          </div>
        </div>
      </div>

      {/* Par groupe */}
      <div className={`${carte} ${cartePadding}`}>
        <h2 className="mb-4 text-sm font-semibold uppercase text-neutral-400">
          Détail par groupe
        </h2>
        <div className="space-y-4">
          {inscriptions.map((ins) => {
            const taux =
              ins.stats.presencesCount + ins.stats.absencesCount > 0
                ? Math.round(
                    (ins.stats.presencesCount /
                      (ins.stats.presencesCount + ins.stats.absencesCount)) *
                      100
                  )
                : null;

            return (
              <div
                key={ins.id}
                className="rounded-lg border border-neutral-200 p-4 dark:border-[#2a2d35]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {ins.groupe.nom}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          ins.statut === "actif"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300"
                        }`}
                      >
                        {ins.statut === "actif" ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {ins.groupe.matiere?.nom ?? "—"} · inscrit le{" "}
                      {formatDate(ins.dateInscription)}
                    </p>
                  </div>
                  <Link
                    href={`/prof/seances?groupeId=${ins.groupe.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Voir les séances <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-neutral-400">Présences</p>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {ins.stats.presencesCount}
                      {taux !== null && (
                        <span className="ml-1 text-xs font-normal text-neutral-400">
                          ({taux}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Absences</p>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {ins.stats.absencesCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Du</p>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(ins.stats.totalDue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Reste dû</p>
                    <p
                      className={`font-semibold ${
                        ins.stats.unpaid > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {ins.stats.unpaid > 0 ? formatCurrency(ins.stats.unpaid) : "À jour"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paiements */}
      <div className={`${carte} ${cartePadding}`}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-neutral-400">
          <Wallet className="h-4 w-4" /> Paiements de vos groupes
        </h2>
        {paiements.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-500">Aucun paiement</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-slate-700">
            {paiements.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {p.groupe.nom}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatDate(p.datePaiement)} · {p.methodePaiement}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(p.montant)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historique de présence */}
      <div className={`${carte} ${cartePadding}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-neutral-400">
            <ClipboardCheck className="h-4 w-4" /> Historique de présence
          </h2>
          <div className="flex gap-1 rounded-lg border border-neutral-200 p-1 dark:border-[#2a2d35]">
            {(
              [
                ["toutes", "Toutes"],
                ["present", "Présents"],
                ["absent", "Absents"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPresenceFilter(value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  presenceFilter === value
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {presencesFiltrees.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-500">Aucune présence</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-slate-700">
            {presencesFiltrees.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {p.statut === "present" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {p.seance.groupe.nom}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDate(p.seance.date)}
                      {p.seance.groupe.matiere ? ` · ${p.seance.groupe.matiere.nom}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium ${
                    p.statut === "present"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {p.statut === "present" ? "Présent" : "Absent"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}