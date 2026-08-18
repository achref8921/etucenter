"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Loader2,
  Wallet,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatDate, formatCurrency, formatTime } from "@/lib/utils";
import { MonthSelector } from "@/components/month-selector";

interface ProfesseurData {
  professeur: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
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
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/utilisateurs"
            className="flex items-center gap-1 text-[13px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Détail Professeur
          </h1>
        </div>
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
          <Link
            href="/admin/utilisateurs"
            className="flex items-center gap-1 text-[13px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {p.prenom} {p.nom}
          </h1>
        </div>
        <MonthSelector month={month} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-[#2a2d35] dark:bg-[#181b22]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <User className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {p.prenom} {p.nom}
            </h2>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{p.email}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Téléphone
            </p>
            <p className="mt-1 text-[13px] text-neutral-900 dark:text-neutral-100">
              {p.telephone || "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Email
            </p>
            <p className="mt-1 text-[13px] text-neutral-900 dark:text-neutral-100">{p.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-[#2a2d35] dark:bg-[#181b22]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Revenus du mois
          </p>
          <TrendingUp className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">Taux</p>
            <p className="text-[13px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {fin.taux}%
            </p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">Net reçu</p>
            <p className="text-[13px] font-semibold tabular-nums text-green-600 dark:text-green-400">
              {formatCurrency(fin.netRevenue)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">Centre</p>
            <p className="text-[13px] font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatCurrency(fin.beneficeCentre)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">Salaire prof</p>
            <p className="text-[13px] font-semibold tabular-nums text-purple-600 dark:text-purple-400">
              {formatCurrency(fin.salaireProf)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-[#2a2d35]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Ses Groupes & Élèves
          </h2>
          <Link
            href={`/admin/finances-professeurs?teacherId=${p.id}`}
            className="flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
          >
            Grand livre <ArrowLeft className="h-3 w-3 rotate-180" />
          </Link>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
          {data.groupes.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
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
                      <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                        {g.matiere?.nom ?? "—"}
                      </span>
                    </div>
                    {gf && (
                      <div className="flex items-center gap-4 text-[12px]">
                        <span className="text-neutral-500 dark:text-neutral-400">
                          Dû:{" "}
                          <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(gf.totalDue)}
                          </span>
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">
                          Payé:{" "}
                          <span className="font-semibold tabular-nums text-green-600 dark:text-green-400">
                            {formatCurrency(gf.totalPaid)}
                          </span>
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">
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
                    <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-100 dark:border-[#2a2d35]">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-neutral-100 dark:border-[#2a2d35]">
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                              Élève
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-center">
                              Présences
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-center">
                              Absences
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-right">
                              Dû
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-right">
                              Payé
                            </th>
                            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-right">
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
                              <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
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
                              <td className="px-3 py-2 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]">
        <div className="border-b border-neutral-200 px-4 py-2.5 dark:border-[#2a2d35]">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Ses Séances
          </h2>
        </div>
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Date
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Groupe
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Horaire
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Statut
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Présences
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {data.seances.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-400"
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
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {formatDate(s.date)}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{s.groupe.nom}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
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
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {s.stats.presentsCount}/{s.stats.totalEleves}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
