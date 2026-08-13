import Link from "next/link";
import {
  Users,
  GraduationCap,
  Calendar,
  DollarSign,
  AlertTriangle,
  BookOpen,
  UserCheck,
  ArrowRight,
  CreditCard,
  TrendingUp,
  Clock,
  Wallet,
} from "lucide-react";
import { getAdminStats } from "@/lib/calculations";
import { getStudentFinanceOverview } from "@/lib/student-finance";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const centreId = (session?.user as any)?.centerId;
  const [stats, totalGroups, totalMatieres, activeInscriptions, recentPaiements, seancesAVenir, topImpayes, studentFinance] =
    await Promise.all([
      getAdminStats(centreId),
      prisma.groupe.count({ where: { centerId: centreId } }),
      prisma.matiere.count({ where: { centerId: centreId } }),
      prisma.inscription.count({ where: { statut: "actif", groupe: { centerId: centreId } } }),
      prisma.paiement.findMany({
        where: { groupe: { centerId: centreId } },
        orderBy: { datePaiement: "desc" },
        take: 5,
        include: {
          eleve: { select: { id: true, nom: true, prenom: true } },
          groupe: { select: { id: true, nom: true } },
        },
      }),
      prisma.seance.findMany({
        where: { statut: { in: ["planifiee", "en_cours"] }, groupe: { centerId: centreId } },
        orderBy: { date: "asc" },
        take: 5,
        include: {
          groupe: {
            select: {
              id: true,
              nom: true,
              prof: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
      }),
      prisma.$queryRawUnsafe(
        `SELECT g.id as groupe_id, g.nom as groupe_nom, 
                u.id as eleve_id, u.nom as eleve_nom, u.prenom as eleve_prenom,
                COALESCE(due.due_total, 0) as due_total,
                COALESCE(paid.paid_total, 0) as paid_total,
                CASE WHEN COALESCE(due.due_total, 0) - COALESCE(paid.paid_total, 0) > 0
                     THEN COALESCE(due.due_total, 0) - COALESCE(paid.paid_total, 0) ELSE 0 END as unpaid
         FROM (
            SELECT pr.eleve_id, s.groupe_id, g.prix_par_seance as due_total
            FROM presences pr
            JOIN seances s ON pr.seance_id = s.id
            JOIN groupes g ON s.groupe_id = g.id
            WHERE pr.statut = 'present' AND s.statut = 'terminee' AND g.center_id = $1::uuid
            GROUP BY pr.eleve_id, s.groupe_id, g.prix_par_seance
         ) due
         JOIN utilisateurs u ON due.eleve_id = u.id
         JOIN groupes g ON due.groupe_id = g.id
         LEFT JOIN (
           SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) as paid_total
           FROM paiements pai
           JOIN groupes g2 ON pai.groupe_id = g2.id
           WHERE g2.center_id = $1::uuid
           GROUP BY pai.eleve_id, pai.groupe_id
         ) paid ON due.eleve_id = paid.eleve_id AND due.groupe_id = paid.groupe_id
         WHERE COALESCE(due.due_total, 0) - COALESCE(paid.paid_total, 0) > 0
         ORDER BY unpaid DESC
         LIMIT 5`,
         centreId
      ),
      getStudentFinanceOverview(centreId),
    ]);

  const statCards = [
    {
      title: "Credit Disponible",
      value: formatCurrency(studentFinance.availableCredits),
      icon: Wallet,
      color: "bg-teal-500",
      shadow: "shadow-teal-200",
      href: "/admin/finances",
    },
    {
      title: "Dettes Eleves",
      value: formatCurrency(studentFinance.studentDebt),
      icon: AlertTriangle,
      color: "bg-red-500",
      shadow: "shadow-red-200",
      href: "/admin/finances",
    },
    {
      title: "Eleves",
      value: stats.totalStudents,
      icon: Users,
      color: "bg-blue-500",
      shadow: "shadow-blue-200",
      href: "/admin/utilisateurs",
    },
    {
      title: "Prof",
      value: stats.totalTeachers,
      icon: GraduationCap,
      color: "bg-green-500",
      shadow: "shadow-green-200",
      href: "/admin/utilisateurs",
    },
    {
      title: "Groupes",
      value: totalGroups,
      icon: UserCheck,
      color: "bg-indigo-500",
      shadow: "shadow-indigo-200",
      href: "/admin/groupes",
    },
    {
      title: "Matieres",
      value: totalMatieres,
      icon: BookOpen,
      color: "bg-orange-500",
      shadow: "shadow-orange-200",
      href: "/admin/matieres",
    },
    {
      title: "Inscriptions Actives",
      value: activeInscriptions,
      icon: UserCheck,
      color: "bg-teal-500",
      shadow: "shadow-teal-200",
      href: "/admin/groupes",
    },
    {
      title: "Seances Terminees",
      value: stats.totalSeances,
      icon: Calendar,
      color: "bg-purple-500",
      shadow: "shadow-purple-200",
      href: "/admin/groupes",
    },
    {
      title: "Revenus Totaux",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "bg-emerald-500",
      shadow: "shadow-emerald-200",
      href: "/admin/finances",
    },
    {
      title: "Impayes",
      value: formatCurrency(stats.totalUnpaid),
      icon: AlertTriangle,
      color: "bg-red-500",
      shadow: "shadow-red-200",
      href: "/admin/finances",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tableau de bord</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/benefices"
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
          >
            <TrendingUp className="h-4 w-4" /> Benefices
          </Link>
          <Link
            href="/admin/finances"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <CreditCard className="h-4 w-4" /> Finances
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.title}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600">{card.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color} shadow-md ${card.shadow}`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
              Voir details <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Derniers Paiements</h2>
            <Link href="/admin/finances" className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {recentPaiements.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Aucun paiement</p>
            ) : (
              recentPaiements.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 text-xs font-semibold text-green-700 dark:text-green-400">
                      {p.eleve.prenom[0]}{p.eleve.nom[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.eleve.prenom} {p.eleve.nom}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.groupe.nom} · {formatDateTime(p.datePaiement)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(Number(p.montant))}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prochaines Seances</h2>
            <Link href="/admin/groupes" className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {seancesAVenir.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Aucune seance planifiee</p>
            ) : (
              seancesAVenir.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
                      <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.groupe.nom}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {s.groupe.prof ? `${s.groupe.prof.prenom} ${s.groupe.prof.nom}` : "—"} · {formatDate(s.date)}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.statut === "planifiee" ? "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300" : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300"
                  }`}>
                    {s.statut === "planifiee" ? "Planifiee" : "En cours"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top Impayes</h2>
          <Link href="/admin/finances" className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800">
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Eleve</th>
                <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Groupe</th>
                <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Du</th>
                <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Paye</th>
                <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Impaye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {(topImpayes as any[]).length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-500 dark:text-gray-400">Aucun impaye</td></tr>
              ) : (
                (topImpayes as any[]).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-5 py-3">
                      <Link href={`/admin/eleves/${item.eleve_id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        {item.eleve_prenom} {item.eleve_nom}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/groupes/${item.groupe_id}`} className="text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:underline">
                        {item.groupe_nom}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{formatCurrency(Number(item.due_total))}</td>
                    <td className="px-5 py-3 text-green-600 dark:text-green-400">{formatCurrency(Number(item.paid_total))}</td>
                    <td className="px-5 py-3 font-semibold text-red-600 dark:text-red-400">{formatCurrency(Number(item.unpaid))}</td>
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
