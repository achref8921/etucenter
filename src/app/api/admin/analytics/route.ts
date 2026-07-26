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
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const centerId = (session.user as any).centerId;
    if (!centerId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalStudents,
      studentsThisMonth,
      studentsLastMonth,
      totalTeachers,
      totalSeances,
      seancesThisMonth,
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      totalUnpaid,
      topAbsenceTeacher,
      topProfitSubject,
      monthlyRevenue,
      monthlyStudents,
      monthlyPresences,
    ] = await Promise.all([
      prisma.utilisateur.count({ where: { centerId, role: "eleve" } }),
      prisma.utilisateur.count({ where: { centerId, role: "eleve", createdAt: { gte: startOfMonth } } }),
      prisma.utilisateur.count({ where: { centerId, role: "eleve", createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.utilisateur.count({ where: { centerId, role: "prof" } }),
      prisma.seance.count({ where: { groupe: { centerId }, statut: "terminee" } }),
      prisma.seance.count({ where: { groupe: { centerId }, statut: "terminee", date: { gte: startOfMonth } } }),
      prisma.paiement.aggregate({ where: { groupe: { centerId } }, _sum: { montant: true } }),
      prisma.paiement.aggregate({ where: { groupe: { centerId }, datePaiement: { gte: startOfMonth } }, _sum: { montant: true } }),
      prisma.paiement.aggregate({ where: { groupe: { centerId }, datePaiement: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { montant: true } }),

      prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT COALESCE(SUM(GREATEST(
          (g.prix_par_seance - COALESCE(pa.total_paid, 0)::numeric), 0
        )::float), 0) AS total_unpaid
        FROM (
          SELECT DISTINCT pr.eleve_id, s.groupe_id
          FROM presences pr
          JOIN seances s ON pr.seance_id = s.id
          WHERE pr.statut = 'present' AND s.statut = 'terminee'
        ) p
        JOIN groupes g ON p.groupe_id = g.id AND g.center_id = $1::uuid
        LEFT JOIN (
          SELECT eleve_id, groupe_id, SUM(montant)::float AS total_paid
          FROM paiements GROUP BY eleve_id, groupe_id
        ) pa ON p.eleve_id = pa.eleve_id AND p.groupe_id = pa.groupe_id
      `, centerId),

      prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT u.id, u.nom, u.prenom,
          COUNT(CASE WHEN pr.statut = 'absent' THEN 1 END)::int AS absences
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        JOIN utilisateurs u ON g.prof_id = u.id
        WHERE g.center_id = $1::uuid AND s.statut = 'terminee'
        GROUP BY u.id, u.nom, u.prenom ORDER BY absences DESC LIMIT 5
      `, centerId),

      prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT m.id, m.nom, COALESCE(SUM(pa.montant), 0)::float AS total_revenue
        FROM matieres m JOIN groupes g ON g.matiere_id = m.id
        LEFT JOIN paiements pa ON pa.groupe_id = g.id
        WHERE m.center_id = $1::uuid
        GROUP BY m.id, m.nom ORDER BY total_revenue DESC LIMIT 5
      `, centerId),

      prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT TO_CHAR(pa.date_paiement, 'YYYY-MM') AS month, SUM(pa.montant)::float AS revenue
        FROM paiements pa JOIN groupes g ON pa.groupe_id = g.id
        WHERE g.center_id = $1::uuid AND pa.date_paiement >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(pa.date_paiement, 'YYYY-MM') ORDER BY month ASC
      `, centerId),

      prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT TO_CHAR(u.created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM utilisateurs u
        WHERE u.center_id = $1::uuid AND u.role = 'eleve' AND u.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(u.created_at, 'YYYY-MM') ORDER BY month ASC
      `, centerId),

      prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT TO_CHAR(s.date, 'YYYY-MM') AS month,
          COUNT(CASE WHEN pr.statut = 'present' THEN 1 END)::int AS present,
          COUNT(CASE WHEN pr.statut = 'absent' THEN 1 END)::int AS absent
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        WHERE g.center_id = $1::uuid AND s.date >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(s.date, 'YYYY-MM') ORDER BY month ASC
      `, centerId),
    ]);

    const totalPaid = n(totalRevenue._sum.montant);
    const paidThisMonth = n(revenueThisMonth._sum.montant);
    const paidLastMonth = n(revenueLastMonth._sum.montant);
    const unpaidAmount = Array.isArray(totalUnpaid) ? n(totalUnpaid[0]?.total_unpaid) : 0;
    const revenueChange = paidLastMonth > 0 ? ((paidThisMonth - paidLastMonth) / paidLastMonth * 100) : 0;

    const mp = Array.isArray(monthlyPresences) ? monthlyPresences : [];
    const totalPresences = mp.reduce((s, m) => s + n(m.present) + n(m.absent), 0);
    const totalAbsences = mp.reduce((s, m) => s + n(m.absent), 0);
    const absenceRate = totalPresences > 0 ? (totalAbsences / totalPresences * 100) : 0;

    const studentsChange = studentsLastMonth > 0 ? ((studentsThisMonth - studentsLastMonth) / studentsLastMonth * 100) : 0;

    return NextResponse.json({
      totalStudents: n(totalStudents),
      studentsThisMonth: n(studentsThisMonth),
      studentsChange: Math.round(studentsChange * 10) / 10,
      totalTeachers: n(totalTeachers),
      totalSeances: n(totalSeances),
      seancesThisMonth: n(seancesThisMonth),
      totalPaid,
      paidThisMonth,
      paidLastMonth,
      revenueChange: Math.round(revenueChange * 10) / 10,
      unpaidAmount,
      absenceRate: Math.round(absenceRate * 10) / 10,
      topAbsenceTeacher: (Array.isArray(topAbsenceTeacher) ? topAbsenceTeacher : []).map((t) => ({
        id: String(t.id), nom: String(t.nom), prenom: String(t.prenom), absences: n(t.absences),
      })),
      topProfitSubject: (Array.isArray(topProfitSubject) ? topProfitSubject : []).map((s) => ({
        id: String(s.id), nom: String(s.nom), totalRevenue: n(s.total_revenue),
      })),
      monthlyRevenue: (Array.isArray(monthlyRevenue) ? monthlyRevenue : []).map((m) => ({
        month: String(m.month), revenue: n(m.revenue),
      })),
      monthlyStudents: (Array.isArray(monthlyStudents) ? monthlyStudents : []).map((m) => ({
        month: String(m.month), count: n(m.count),
      })),
      monthlyPresences: mp.map((m) => ({
        month: String(m.month), present: n(m.present), absent: n(m.absent),
      })),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
