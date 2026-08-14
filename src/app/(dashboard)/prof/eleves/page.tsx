"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  DollarSign,
  CheckCircle2,
  XCircle,
  GraduationCap,
  Loader2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface GroupeDetail {
  id: string;
  nom: string;
  matiere: string;
  prixParSeance: number;
  seancesTotalies: number;
  due: number;
  paye: number;
  impaye: number;
  avance: number;
  presences: number;
  absences: number;
  tauxPresence: number;
}

interface StudentData {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  codeEleve: string | null;
  niveau: string | null;
  classe: string | null;
  filiere: string | null;
  dateNaissance: string | null;
  groupes: GroupeDetail[];
  totalDue: number;
  totalPaid: number;
  impayeTotal: number;
  solde: number;
}

export default function ProfElevesPage() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");

  useEffect(() => {
    fetch(`/api/prof/eleves?timezoneOffset=${new Date().getTimezoneOffset()}`)
      .then((r) => r.json())
      .then((data) => {
        setStudents(data);
        setLoading(false);
      });
  }, []);

  const filtered = students.filter((s) => {
    const matchSearch =
      search === "" ||
      `${s.prenom} ${s.nom}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.codeEleve && s.codeEleve.includes(search));
    const matchFilter =
      filter === "all" ||
      (filter === "paid" && s.impayeTotal === 0) ||
      (filter === "unpaid" && s.impayeTotal > 0);
    return matchSearch && matchFilter;
  });

  const totalStudents = students.length;
  const totalPaid = students.filter((s) => s.impayeTotal === 0).length;
  const totalUnpaid = students.filter((s) => s.impayeTotal > 0).length;
  const totalRevenue = students.reduce((acc, s) => acc + s.totalPaid, 0);
  const totalUnpaidAmount = students.reduce((acc, s) => acc + s.impayeTotal, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mes Élèves</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Suivi des paiements et présences de vos élèves
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Élèves</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">À jour</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalPaid}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Impayés</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{totalUnpaid}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Impayé Total</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalUnpaidAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher par nom ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "unpaid", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === f
                  ? f === "unpaid"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : f === "paid"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {f === "all" ? "Tous" : f === "paid" ? "À jour" : "Impayés"}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center text-slate-400 dark:text-slate-500">
            Aucun élève trouvé
          </div>
        ) : (
          filtered.map((student) => {
            const isExpanded = expandedId === student.id;
            const avgPresence =
              student.groupes.length > 0
                ? Math.round(
                    student.groupes.reduce((a, g) => a + g.tauxPresence, 0) /
                      student.groupes.length
                  )
                : 0;

            return (
              <div
                key={student.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all"
              >
                {/* Main Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : student.id)}
                  className="flex w-full items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${
                        student.impayeTotal > 0
                          ? "bg-gradient-to-br from-red-400 to-red-500"
                          : "bg-gradient-to-br from-emerald-400 to-emerald-500"
                      }`}
                    >
                      {student.prenom[0]}
                      {student.nom[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {student.prenom} {student.nom}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {student.codeEleve && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                            #{student.codeEleve}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {student.niveau} — {student.classe}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {student.groupes.length} groupe(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Presence badge */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          avgPresence >= 80
                            ? "bg-emerald-500"
                            : avgPresence >= 60
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                      />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {avgPresence}% présence
                      </span>
                    </div>

                    {/* Account balance (prepaid − consumed) */}
                    <div className="hidden sm:block text-right min-w-[110px]">
                      <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Solde</p>
                      <p
                        className={`text-sm font-bold ${
                          student.solde >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(student.solde)}
                      </p>
                    </div>

                    {/* Payment status */}
                    <div className="text-right min-w-[120px]">
                      {student.impayeTotal > 0 ? (
                        <>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            −{formatCurrency(student.impayeTotal)}
                          </p>
                          <p className="text-[10px] text-red-400 dark:text-red-500">impayé</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">À jour</p>
                          <p className="text-[10px] text-emerald-400 dark:text-emerald-500">
                            {formatCurrency(student.totalPaid)} payé
                          </p>
                        </>
                      )}
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5 space-y-4">
                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        {student.email ? (
                          <a
                            href={`mailto:${student.email}`}
                            className="text-sm text-blue-600 hover:underline dark:text-blue-400 truncate"
                          >
                            {student.email}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-600 dark:text-slate-400 truncate">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        {student.telephone ? (
                          <a
                            href={`tel:${student.telephone}`}
                            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {student.telephone}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-600 dark:text-slate-400">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">{student.filiere || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {student.dateNaissance
                            ? new Date(student.dateNaissance).toLocaleDateString("fr-FR")
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Contact actions */}
                    {(student.telephone || student.email) && (
                      <div className="flex flex-wrap gap-2">
                        {student.telephone && (
                          <a
                            href={`tel:${student.telephone}`}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
                          >
                            <Phone className="h-3.5 w-3.5" /> Appeler
                          </a>
                        )}
                        {student.email && (
                          <a
                            href={`mailto:${student.email}`}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                          >
                            <Mail className="h-3.5 w-3.5" /> Envoyer un email
                          </a>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    <div className="flex gap-4">
                      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2">
                        <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Dû total</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(student.totalDue)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2">
                        <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Payé</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(student.totalPaid)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2">
                        <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Impayé</p>
                        <p
                          className={`text-sm font-bold ${
                            student.impayeTotal > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCurrency(student.impayeTotal)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2">
                        <p className="text-[10px] uppercase text-slate-400 dark:text-slate-500">Solde</p>
                        <p
                          className={`text-sm font-bold ${
                            student.solde >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatCurrency(student.solde)}
                        </p>
                      </div>
                    </div>

                    {/* Groups Table */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400">Groupe</th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400">Matière</th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 text-center">
                              Séances
                            </th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 text-center">
                              Présences
                            </th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 text-center">
                              Absences
                            </th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 text-center">
                              Taux
                            </th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 text-right">
                              Dû
                            </th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 text-right">
                              Payé
                            </th>
                            <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 text-right">
                              Impayé
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {student.groupes.map((g) => (
                            <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{g.nom}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{g.matiere}</td>
                              <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                                {g.seancesTotalies}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> {g.presences}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 text-red-500 dark:text-red-400 font-medium">
                                  <XCircle className="h-3.5 w-3.5" /> {g.absences}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    g.tauxPresence >= 80
                                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                                      : g.tauxPresence >= 60
                                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                                      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                                  }`}
                                >
                                  {g.tauxPresence}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                                {formatCurrency(g.due)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(g.paye)}
                                </span>
                                {g.avance > 0 && (
                                  <span className="ml-1 text-[10px] text-emerald-500 dark:text-emerald-400">
                                    (avance {formatCurrency(g.avance)})
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`font-semibold ${
                                    g.impaye > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                                  }`}
                                >
                                  {formatCurrency(g.impaye)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
