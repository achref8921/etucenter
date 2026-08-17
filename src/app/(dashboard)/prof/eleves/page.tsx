"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
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
  Eye,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SkeletonPage } from "@/components/ui/skeleton";

interface GroupeDetail {
  id: string;
  nom: string;
  matiere: string;
  prixParSeance: number;
  seancesTotalies: number;
  due: number;
  paye: number;
  impaye: number;
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
}

interface SessionHistory {
  presenceId: string;
  statut: "present" | "absent";
  seance: {
    id: string;
    date: string;
    heureDebut: string | null;
    heureFin: string | null;
    statut: string;
    prixParSeance: number | null;
    groupe: { id: string; nom: string };
  };
}

interface HistoryState {
  loading: boolean;
  sessions: SessionHistory[] | null;
}

export default function ProfElevesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") === "unpaid" ? "unpaid" : "all";
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">(initialFilter);
  const [historyMap, setHistoryMap] = useState<Record<string, HistoryState>>({});

  useEffect(() => {
    fetch(`/api/prof/eleves?timezoneOffset=${new Date().getTimezoneOffset()}`)
      .then((r) => r.json())
      .then((data) => {
        setStudents(data);
        setLoading(false);
      });
  }, []);

  const loadHistory = async (studentId: string) => {
    setHistoryMap((prev) => ({ ...prev, [studentId]: { loading: true, sessions: null } }));
    try {
      const res = await fetch(`/api/prof/eleves/${studentId}/presences`);
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setHistoryMap((prev) => ({ ...prev, [studentId]: { loading: false, sessions: data.sessions || [] } }));
    } catch {
      setHistoryMap((prev) => ({ ...prev, [studentId]: { loading: false, sessions: [] } }));
    }
  };

  const toggleExpand = (student: StudentData) => {
    if (expandedId === student.id) {
      setExpandedId(null);
    } else {
      setExpandedId(student.id);
      if (!historyMap[student.id]) loadHistory(student.id);
    }
  };

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
    return <SkeletonPage />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Mes Élèves</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Suivi des paiements et présences de vos élèves
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Élèves</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">À jour</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalPaid}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Impayés</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{totalUnpaid}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Impayé Total</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalUnpaidAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <input
            type="text"
            placeholder="Rechercher par nom ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  : "bg-white dark:bg-[#181b22] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-[#1e2128] border border-neutral-200 dark:border-[#2a2d35]"
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
          <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-12 text-center text-neutral-400 dark:text-neutral-500">
            Aucun élève trouvé
          </div>
        ) : (
          filtered.map((student) => {
            const isExpanded = expandedId === student.id;
            const history = historyMap[student.id];
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
                className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] overflow-hidden transition-all"
              >
                {/* Main Row */}
                <button
                  onClick={() => toggleExpand(student)}
                  className="flex w-full items-center justify-between p-4 hover:bg-neutral-100/50 dark:hover:bg-[#1e2128] transition-colors text-left"
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
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {student.prenom} {student.nom}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {student.codeEleve && (
                          <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
                            #{student.codeEleve}
                          </span>
                        )}
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          {student.niveau} — {student.classe}
                        </span>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
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
                      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        {avgPresence}% présence
                      </span>
                    </div>

                    {/* Payment status */}
                    <div className="text-right min-w-[120px]">
                      {student.impayeTotal > 0 ? (
                        <>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(student.impayeTotal)}
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
                      <ChevronUp className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="animate-fade-in-up border-t border-neutral-100 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-5 space-y-4">
                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        {student.email ? (
                          <a
                            href={`mailto:${student.email}`}
                            className="text-sm text-blue-600 hover:underline dark:text-blue-400 truncate"
                          >
                            {student.email}
                          </a>
                        ) : (
                          <span className="text-sm text-neutral-600 dark:text-neutral-400 truncate">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        {student.telephone ? (
                          <a
                            href={`tel:${student.telephone}`}
                            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {student.telephone}
                          </a>
                        ) : (
                          <span className="text-sm text-neutral-600 dark:text-neutral-400">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{student.filiere || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
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
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                        Récapitulatif financier (vos groupes)
                      </p>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                        Impayé = Dû − Payé
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="rounded-lg bg-white dark:bg-[#181b22] border border-neutral-200 dark:border-[#2a2d35] px-4 py-2">
                        <p className="text-[10px] uppercase text-neutral-400 dark:text-neutral-500">Dû total</p>
                        <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(student.totalDue)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-[#181b22] border border-neutral-200 dark:border-[#2a2d35] px-4 py-2">
                        <p className="text-[10px] uppercase text-neutral-400 dark:text-neutral-500">Payé</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(student.totalPaid)}
                        </p>
                      </div>
                      <div
                        className="rounded-lg bg-white dark:bg-[#181b22] border border-neutral-200 dark:border-[#2a2d35] px-4 py-2"
                        title="Montant restant dû = Dû − Payé (0 si payé en avance)"
                      >
                        <p className="text-[10px] uppercase text-neutral-400 dark:text-neutral-500">Impayé</p>
                        <p
                          className={`text-sm font-bold ${
                            student.impayeTotal > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCurrency(student.impayeTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Groups Table */}
                    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-neutral-100 dark:border-[#2a2d35]">
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Groupe</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Matière</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-center">
                              Séances
                            </th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-center">
                              Présences
                            </th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-center">
                              Absences
                            </th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-center">
                              Taux
                            </th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-right">
                              Dû
                            </th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-right">
                              Payé
                            </th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 text-right">
                              Impayé
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                          {student.groupes.map((g) => (
                            <tr key={g.id} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                              <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">{g.nom}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{g.matiere}</td>
                              <td className="px-4 py-3 text-center text-neutral-600 dark:text-neutral-400">
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
                              <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                                {formatCurrency(g.due)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(g.paye)}
                                </span>
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

                    {/* Session history */}
                    <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-2.5">
                        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                          Historique des présences
                        </h4>
                        {history && history.sessions && history.sessions.length > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {history.sessions.filter((s) => s.statut === "present").length} présences
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium text-red-500 dark:text-red-400">
                              <XCircle className="h-3.5 w-3.5" />
                              {history.sessions.filter((s) => s.statut === "absent").length} absences
                            </span>
                          </div>
                        )}
                      </div>
                      {history?.loading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                        </div>
                      ) : !history || !history.sessions || history.sessions.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">
                          Aucun historique de présences
                        </p>
                      ) : (
                        <div className="max-h-72 overflow-y-auto">
                          <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
                            {history.sessions.map((s) => (
                              <li
                                key={s.presenceId}
                                className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      s.statut === "present"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                        : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                    }`}
                                  >
                                    {s.statut === "present" ? (
                                      <CheckCircle2 className="h-3 w-3" />
                                    ) : (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                    {s.statut === "present" ? "Présent" : "Absent"}
                                  </span>
                                  <span className="truncate text-sm text-neutral-600 dark:text-neutral-400">
                                    {formatDate(s.seance.date)}
                                    {s.seance.heureDebut &&
                                      ` · ${new Date(s.seance.heureDebut).toLocaleTimeString("fr-FR", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}`}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="hidden text-xs text-neutral-400 sm:inline dark:text-neutral-500">
                                    {s.seance.groupe.nom}
                                  </span>
                                  <button
                                    onClick={() => router.push(`/prof/presences/${s.seance.id}`)}
                                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Voir
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
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
