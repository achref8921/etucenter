"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Wallet,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatDate, formatCurrency, formatTime } from "@/lib/utils";
import { MonthSelector } from "@/components/month-selector";
import UserAvatar from "@/components/user-avatar";

interface ProfesseurData {
  professeur: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    updatedAt?: string;
    hasImage?: boolean;
  };
  groupes: {
    id: string;
    nom: string;
    matiere: { id: string; nom: string } | null;
    _count: { inscriptions: number; seances: number };
  }[];
  seances: {
    id: string;
    date: string;
    heureDebut: string | null;
    heureFin: string | null;
    statut: string;
    groupe: { id: string; nom: string };
    stats: { presentsCount: number; totalEleves: number };
  }[];
  finance: {
    taux: number;
    netRevenue: number;
    beneficeCentre: number;
    salaireProf: number;
    nombreEleves: number;
  };
  groupeFinancials: Record<
    string,
    {
      totalDue: number;
      totalPaid: number;
      unpaid: number;
      students: {
        eleveId: string;
        nom: string;
        prenom: string;
        presences: number;
        absences: number;
        totalDue: number;
        totalPaid: number;
        unpaid: number;
      }[];
    }
  >;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminProfesseurDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const router = useRouter();
  const month = searchParams.get("month") || getCurrentMonth();

  const [data, setData] = useState<ProfesseurData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingFinance, setLoadingFinance] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/professeurs/${id}?month=${month}`);
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
        setLoadingFinance(false);
      }
    };

    fetchData();
  }, [id, month]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Détail Professeur
        </h1>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  const p = data.professeur;
  const fin = data.finance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            {p.prenom} {p.nom}
          </h1>
        </div>
        <MonthSelector month={month} />
      </div>

      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-4">
          <UserAvatar userId={p.id} nom={p.nom} prenom={p.prenom} hasImage={p.hasImage} version={p.updatedAt} size="md" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {p.prenom} {p.nom}
            </h2>
            <p className="text-[13px] text-[var(--foreground-faint)]">{p.email}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
              Téléphone
            </p>
            <p className="mt-1 text-[13px] text-[var(--foreground)]">
              {p.telephone || "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
              Email
            </p>
            <p className="mt-1 text-[13px] text-[var(--foreground)]">{p.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
            Revenus du mois
          </p>
          <TrendingUp className="h-4 w-4 text-[var(--foreground-faint)]" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[12px] text-[var(--foreground-faint)]">Taux</p>
            <p className="text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
              {fin.taux}%
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[var(--foreground-faint)]">Net reçu</p>
            <p className="text-[13px] font-semibold tabular-nums text-green-600 dark:text-green-400">
              {formatCurrency(fin.netRevenue)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[var(--foreground-faint)]">Centre</p>
            <p className="text-[13px] font-semibold tabular-nums text-blue-700 dark:text-blue-400">
              {formatCurrency(fin.beneficeCentre)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-[var(--foreground-faint)]">Salaire prof</p>
            <p className="text-[13px] font-semibold tabular-nums text-purple-600 dark:text-purple-400">
              {formatCurrency(fin.salaireProf)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
            Ses Groupes & Élèves
          </h2>
          <Link
            href={`/admin/finances-professeurs?teacherId=${p.id}`}
            className="flex items-center gap-1 text-[12px] font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400"
          >
            Grand livre <ArrowLeft className="h-3 w-3 rotate-180" />
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {data.groupes.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--foreground-faint)]">
              Aucun groupe assigné
            </p>
          ) : (
            data.groupes.map((g) => {
              const gf = data.groupeFinancials[g.id];
              return (
                <div key={g.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/groupes/${g.id}`}
                        className="text-[13px] font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
                      >
                        {g.nom}
                      </Link>
                      <span className="text-[12px] text-[var(--foreground-faint)]">
                        {g.matiere?.nom ?? "—"}
                      </span>
                    </div>
                    {gf && (
                      <div className="flex items-center gap-4 text-[12px]">
                        <span className="text-[var(--foreground-faint)]">
                          Dû:{" "}
                          <span className="font-semibold tabular-nums text-[var(--foreground)]">
                            {formatCurrency(gf.totalDue)}
                          </span>
                        </span>
                        <span className="text-[var(--foreground-faint)]">
                          Payé:{" "}
                          <span className="font-semibold tabular-nums text-green-600 dark:text-green-400">
                            {formatCurrency(gf.totalPaid)}
                          </span>
                        </span>
                        <span className="text-[var(--foreground-faint)]">
                          Impayé:{" "}
                          <span
                            className={`font-semibold tabular-nums ${
                              gf.unpaid > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                            }`}
                          >
                            {formatCurrency(gf.unpaid)}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  {gf && gf.students.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                              Élève
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] text-center">
                              Présences
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] text-center">
                              Absences
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] text-right">
                              Dû
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] text-right">
                              Payé
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] text-right">
                              Impayé
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50 dark:divide-[#2a2d35]">
                          {gf.students.map((s) => (
                            <tr
                              key={s.eleveId}
                              className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                            >
                              <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                                <Link
                                  href={`/admin/eleves/${s.eleveId}`}
                                  className="hover:underline"
                                >
                                  {s.prenom} {s.nom}
                                </Link>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {s.presences}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center gap-1 text-red-500 dark:text-red-400">
                                  <XCircle className="h-3 w-3" />
                                  {s.absences}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-[var(--foreground)]">
                                {formatCurrency(s.totalDue)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                                {formatCurrency(s.totalPaid)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                <span
                                  className={`font-medium ${
                                    s.unpaid > 0
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-green-600 dark:text-green-400"
                                  }`}
                                >
                                  {formatCurrency(s.unpaid)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="border-b border-[var(--border)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
            Ses Séances
          </h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Date
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Groupe
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Horaire
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Statut
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                Présences
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.seances.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-[var(--foreground-faint)]"
                >
                  Aucune séance
                </td>
              </tr>
            ) : (
              data.seances.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                >
                  <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                    {formatDate(s.date)}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{s.groupe.nom}</td>
                  <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                    {s.heureDebut && s.heureFin
                      ? `${formatTime(s.heureDebut)} - ${formatTime(s.heureFin)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.statut === "planifiee"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : s.statut === "en_cours"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : s.statut === "terminee"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-neutral-100 text-neutral-800 dark:bg-[#2a2d35] dark:text-neutral-200"
                      }`}
                    >
                      {s.statut === "planifiee"
                        ? "Planifiée"
                        : s.statut === "en_cours"
                          ? "En cours"
                          : s.statut === "terminee"
                            ? "Terminée"
                            : "Annulée"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--foreground-subtle)]">
                    {s.stats.presentsCount}/{s.stats.totalEleves}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
