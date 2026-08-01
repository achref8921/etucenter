import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function n(v: unknown): number {
  return Number(v ?? 0);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalCenters,
      activeCenters,
      suspendedCenters,
      totalUsers,
      totalStudents,
      totalTeachers,
      totalGroups,
      totalRevenue,
      revenueThisMonth,
      expiringSoon,
      cancelledSubscriptions,
      monthlyRevenue,
      centerRevenue,
      recentSubscriptions,
    ] = await Promise.all([
      prisma.center.count(),
      prisma.center.count({ where: { active: true } }),
      prisma.center.count({ where: { active: false } }),
      prisma.utilisateur.count({ where: { role: { not: "super_admin" }, deletedAt: null } }),
      prisma.utilisateur.count({ where: { role: "eleve", deletedAt: null } }),
      prisma.utilisateur.count({ where: { role: "prof", deletedAt: null } }),
      prisma.groupe.count(),
      prisma.centerSubscription.aggregate({
        where: { statut: "active" },
        _sum: { montant: true },
      }),
      prisma.centerSubscription.aggregate({
        where: {
          statut: "active",
          dateDebut: { lte: endOfMonth },
          dateFin: { gte: startOfMonth },
        },
        _sum: { montant: true },
      }),
      prisma.centerSubscription.findMany({
        where: {
          statut: "active",
          dateFin: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
        include: { center: { select: { id: true, name: true } } },
        orderBy: { dateFin: "asc" },
      }),
      prisma.centerSubscription.findMany({
        where: { statut: "cancelled" },
        include: { center: { select: { id: true, name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.$queryRawUnsafe<{ month: string; revenue: number }[]>(`
        SELECT TO_CHAR(cs.date_debut, 'YYYY-MM') AS month, SUM(cs.montant)::float AS revenue
        FROM center_subscriptions cs
        WHERE cs.statut IN ('active', 'expired')
          AND cs.date_debut >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(cs.date_debut, 'YYYY-MM') ORDER BY month ASC
      `),
      prisma.$queryRawUnsafe<{ id: string; name: string; total_paid: number; subscription_count: number }[]>(`
        SELECT c.id, c.name,
          COALESCE(SUM(cs.montant), 0)::float AS total_paid,
          COUNT(cs.id)::int AS subscription_count
        FROM centers c
        LEFT JOIN center_subscriptions cs ON cs.center_id = c.id AND cs.statut IN ('active', 'expired')
        GROUP BY c.id, c.name ORDER BY total_paid DESC
      `),
      prisma.centerSubscription.findMany({
        where: { statut: { in: ["active", "expired"] } },
        include: { center: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const totalSubAmount = n(totalRevenue._sum.montant);
    const thisMonthAmount = n(revenueThisMonth._sum.montant);

    return NextResponse.json({
      totalCenters: n(totalCenters),
      activeCenters: n(activeCenters),
      suspendedCenters: n(suspendedCenters),
      totalUsers: n(totalUsers),
      totalStudents: n(totalStudents),
      totalTeachers: n(totalTeachers),
      totalGroups: n(totalGroups),
      totalSubAmount,
      thisMonthAmount,
      subscriptionsThisMonth: (await prisma.centerSubscription.findMany({
        where: {
          statut: "active",
          dateDebut: { lte: endOfMonth },
          dateFin: { gte: startOfMonth },
        },
      })).length,
      expiringSoon: expiringSoon.map((s) => ({
        id: String(s.id),
        centerName: s.center.name,
        centerId: String(s.center.id),
        dateFin: s.dateFin.toISOString(),
        montant: n(s.montant),
      })),
      cancelledSubscriptions: cancelledSubscriptions.map((s) => ({
        id: String(s.id),
        centerName: s.center.name,
        centerId: String(s.center.id),
        dateFin: s.dateFin.toISOString(),
        montant: n(s.montant),
      })),
      monthlyRevenue: (Array.isArray(monthlyRevenue) ? monthlyRevenue : []).map((m) => ({
        month: String(m.month),
        revenue: n(m.revenue),
      })),
      centerRevenue: (Array.isArray(centerRevenue) ? centerRevenue : []).map((c) => ({
        id: String(c.id),
        name: String(c.name),
        totalPaid: n(c.total_paid),
        subscriptionCount: n(c.subscription_count),
      })),
      recentSubscriptions: recentSubscriptions.map((s) => ({
        id: String(s.id),
        centerName: s.center.name,
        centerId: String(s.center.id),
        montant: n(s.montant),
        dateDebut: s.dateDebut.toISOString(),
        dateFin: s.dateFin.toISOString(),
        statut: String(s.statut),
      })),
    });
  } catch (error) {
    console.error("Super admin analytics error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
