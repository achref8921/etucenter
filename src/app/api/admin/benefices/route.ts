import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/teacher-finance";
import { getAdminDashboardMonthData } from "@/lib/admin-dashboard-data";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");

    const now = new Date();
    const selectedMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const centreId = (session.user as any).centerId;

    const dashboardData = await getAdminDashboardMonthData(centreId, selectedMonth);

    const monthPaiements = await prisma.paiement.findMany({
      where: {
        groupe: { centerId: centreId },
        datePaiement: { gte: startDate, lte: endDate },
      },
      orderBy: { datePaiement: "desc" },
      include: {
        eleve: { select: { id: true, nom: true, prenom: true } },
        groupe: { select: { id: true, nom: true } },
      },
    });

    const reversePendingDebts = await prisma.teacherCenterDebt.findMany({
      where: {
        centerId: centreId,
        status: { in: ["OPEN", "PARTIAL"] },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        createdAt: true,
        amountDue: true,
        amountPaid: true,
        balance: true,
        status: true,
        teacher: { select: { id: true, nom: true, prenom: true } },
        student: { select: { id: true, nom: true, prenom: true } },
      },
    });

    interface PendingDebtEntry {
      id: string;
      date: Date;
      amountDue: number;
      amountPaid: number;
      balance: number;
      status: string;
      student: { id: string; nom: string; prenom: string } | null;
    }

    const pendingProfMap = new Map<
      string,
      { prof: { id: string; nom: string; prenom: string }; balance: number; debts: PendingDebtEntry[] }
    >();

    for (const d of reversePendingDebts) {
      const balance = round2(Number(d.balance));
      if (balance <= 0) continue;
      const entry =
        pendingProfMap.get(d.teacher.id) ?? { prof: d.teacher, balance: 0, debts: [] };
      entry.balance = round2(entry.balance + balance);
      entry.debts.push({
        id: d.id,
        date: d.createdAt,
        amountDue: Number(d.amountDue),
        amountPaid: Number(d.amountPaid),
        balance,
        status: d.status,
        student: d.student,
      });
      pendingProfMap.set(d.teacher.id, entry);
    }

    const reversePendingProfs = Array.from(pendingProfMap.values()).sort(
      (a, b) => b.balance - a.balance
    );

    const profsData = dashboardData.profs.map((p) => ({
      prof: p.prof,
      tauxPourcentage: p.taux,
      totalRecu: p.netRevenue,
      beneficeCentre: round2(p.beneficeCentre + (p.reverseSettledRevenue ?? 0)),
      salaireProf: p.salaireProf,
      nombreEleves: p.nombreEleves,
    }));

    const totalRecu = dashboardData.netPaidSessionsRevenue;
    const totalBenefice = dashboardData.totalCenterBenefit;
    const totalSalaire = totalRecu - dashboardData.netCenterEarnings;

    const monthlyHistory = await computeMonthlyHistory(centreId, now);

    return NextResponse.json({
      selectedMonth,
      profs: profsData,
      totalRecu,
      totalBenefice,
      totalSalaire,
      reverseSettledRevenue: dashboardData.reverseSettledRevenue,
      reversePendingBalance: dashboardData.reversePendingBalance,
      reversePendingProfs,
      monthlyHistory,
      monthPaiements,
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

async function computeMonthlyHistory(
  centreId: string,
  now: Date
): Promise<{ month: string; totalBenefice: number; totalRecu: number; totalSalaire: number }[]> {
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [paymentRows, reverseRows] = await Promise.all([
    prisma.$queryRawUnsafe<
      { month: string; prof_id: string | null; recu: number; benefice: number }[]
    >(
      `
      SELECT TO_CHAR(pa.date_paiement, 'YYYY-MM') AS month, g.prof_id,
             SUM(pa.montant)::float AS recu,
             SUM(COALESCE(pa.part_centre, (pa.montant * COALESCE(tb.taux_pourcentage, 20)) / 100))::float AS benefice
      FROM paiements pa
      JOIN groupes g ON pa.groupe_id = g.id
      LEFT JOIN taux_benefices tb ON tb.prof_id = g.prof_id
      WHERE g.center_id = $1::uuid AND pa.date_paiement >= $2::timestamptz
        AND pa.collecte_par_prof = false
      GROUP BY TO_CHAR(pa.date_paiement, 'YYYY-MM'), g.prof_id
      `,
      centreId,
      twelveMonthsAgo
    ),
    prisma.$queryRawUnsafe<{ month: string; settled: number }[]>(
      `
      SELECT TO_CHAR(tt.date, 'YYYY-MM') AS month, COALESCE(SUM(tt.amount), 0)::float AS settled
      FROM teacher_transactions tt
      WHERE tt.center_id = $1::uuid AND tt.mode = 'REVERSE' AND tt.type = 'CENTER_SETTLEMENT' AND tt.status = 'active'
        AND tt.date >= $2::timestamptz
      GROUP BY TO_CHAR(tt.date, 'YYYY-MM')
      `,
      centreId,
      twelveMonthsAgo
    ),
  ]);

  const monthAgg = new Map<string, { recu: number; benefice: number; settled: number }>();
  for (const r of paymentRows) {
    const agg = monthAgg.get(r.month) ?? { recu: 0, benefice: 0, settled: 0 };
    agg.recu += Number(r.recu || 0);
    agg.benefice += Number(r.benefice || 0);
    monthAgg.set(r.month, agg);
  }
  for (const r of reverseRows) {
    const agg = monthAgg.get(r.month) ?? { recu: 0, benefice: 0, settled: 0 };
    agg.settled += Number(r.settled || 0);
    monthAgg.set(r.month, agg);
  }

  const monthlyHistory: { month: string; totalBenefice: number; totalRecu: number; totalSalaire: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const agg = monthAgg.get(mLabel) ?? { recu: 0, benefice: 0, settled: 0 };
    monthlyHistory.push({
      month: mLabel,
      totalBenefice: round2(agg.benefice + agg.settled),
      totalRecu: agg.recu,
      totalSalaire: round2(agg.recu - agg.benefice),
    });
  }

  return monthlyHistory;
}
