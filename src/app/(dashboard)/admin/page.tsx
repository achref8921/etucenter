import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { getAdminStats } from "@/lib/calculations";
import { getStudentFinanceOverview } from "@/lib/student-finance";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { StatCards, SeancesUpcoming, TopImpayes } from "./admin-widgets";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const centreId = (session?.user as any)?.centerId;
  const serverNow = new Date();
  const startOfToday = new Date(serverNow.getFullYear(), serverNow.getMonth(), serverNow.getDate());
  const startOfTomorrow = new Date(serverNow.getFullYear(), serverNow.getMonth(), serverNow.getDate() + 1);
  const startOfMonth = new Date(serverNow.getFullYear(), serverNow.getMonth(), 1);
  const startOfLastMonth = new Date(serverNow.getFullYear(), serverNow.getMonth() - 1, 1);

  const [stats, totalGroups, totalMatieres, activeInscriptions, recentPaiements, seancesAVenir, topImpayes, studentFinance, seancesAujourdhui, monthRevenueAgg, lastMonthRevenueAgg] =
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
      prisma.seance.count({
        where: {
          groupe: { centerId: centreId },
          date: { gte: startOfToday, lt: startOfTomorrow },
        },
      }),
      prisma.paiement.aggregate({
        _sum: { montant: true },
        where: { groupe: { centerId: centreId }, datePaiement: { gte: startOfMonth } },
      }),
      prisma.paiement.aggregate({
        _sum: { montant: true },
        where: { groupe: { centerId: centreId }, datePaiement: { gte: startOfLastMonth, lt: startOfMonth } },
      }),
    ]);

  const monthRevenue = Number(monthRevenueAgg._sum.montant ?? 0);
  const lastMonth = Number(lastMonthRevenueAgg._sum.montant ?? 0);
  const revenueTrend =
    lastMonth > 0 ? Math.round(((monthRevenue - lastMonth) / lastMonth) * 100) : null;

  const statCards = [
    {
      title: "Crédit Disponible",
      value: studentFinance.availableCredits,
      format: "currency" as const,
      icon: "wallet",
      color: "bg-teal-500",
      shadow: "shadow-teal-200",
      href: "/admin/finances",
      sub: `${studentFinance.positiveCount} élève${studentFinance.positiveCount > 1 ? "s" : ""} en crédit`,
      subTone: "good" as const,
    },
    {
      title: "Dettes Élèves",
      value: studentFinance.studentDebt,
      format: "currency" as const,
      icon: "alert",
      color: "bg-red-500",
      shadow: "shadow-red-200",
      href: "/admin/finances",
      sub: `${studentFinance.negativeCount} élève${studentFinance.negativeCount > 1 ? "s" : ""} concerné${studentFinance.negativeCount > 1 ? "s" : ""}`,
      subTone: "bad" as const,
    },
    {
      title: "Élèves",
      value: stats.totalStudents,
      format: "number" as const,
      icon: "users",
      color: "bg-blue-500",
      shadow: "shadow-blue-200",
      href: "/admin/utilisateurs",
    },
    {
      title: "Prof",
      value: stats.totalTeachers,
      format: "number" as const,
      icon: "prof",
      color: "bg-green-500",
      shadow: "shadow-green-200",
      href: "/admin/utilisateurs",
    },
    {
      title: "Groupes",
      value: totalGroups,
      format: "number" as const,
      icon: "groups",
      color: "bg-indigo-500",
      shadow: "shadow-indigo-200",
      href: "/admin/groupes",
    },
    {
      title: "Matières",
      value: totalMatieres,
      format: "number" as const,
      icon: "book",
      color: "bg-orange-500",
      shadow: "shadow-orange-200",
      href: "/admin/matieres",
    },
    {
      title: "Inscriptions Actives",
      value: activeInscriptions,
      format: "number" as const,
      icon: "check",
      color: "bg-teal-500",
      shadow: "shadow-teal-200",
      href: "/admin/groupes",
    },
    {
      title: "Séances Terminées",
      value: stats.totalSeances,
      format: "number" as const,
      icon: "calendar",
      color: "bg-purple-500",
      shadow: "shadow-purple-200",
      href: "/admin/groupes",
      sub: `${seancesAujourdhui} aujourd'hui`,
      subTone: "neutral" as const,
    },
    {
      title: "Revenus Totaux",
      value: stats.totalRevenue,
      format: "currency" as const,
      icon: "dollar",
      color: "bg-emerald-500",
      shadow: "shadow-emerald-200",
      href: "/admin/finances",
      sub: `${formatCurrency(monthRevenue)} ce mois${
        revenueTrend !== null ? ` · ${revenueTrend >= 0 ? "+" : ""}${revenueTrend}% vs mois dern.` : ""
      }`,
      subTone: "good" as const,
    },
    {
      title: "Impayés",
      value: stats.totalUnpaid,
      format: "currency" as const,
      icon: "alert",
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

      <StatCards cards={statCards} />

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

        <SeancesUpcoming
          seances={seancesAVenir.map((s) => ({
            id: s.id,
            date: s.date.toISOString(),
            heureFin: s.heureFin ? s.heureFin.toISOString() : null,
            statut: s.statut,
            groupe: {
              id: s.groupe.id,
              nom: s.groupe.nom,
              prof: s.groupe.prof
                ? { id: s.groupe.prof.id, nom: s.groupe.prof.nom, prenom: s.groupe.prof.prenom }
                : null,
            },
          }))}
        />
      </div>

      <TopImpayes rows={topImpayes as any[]} />
    </div>
  );
}
