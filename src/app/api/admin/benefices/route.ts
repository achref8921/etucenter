import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CENTER_SHARE } from "@/lib/teacher-finance";
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
      take: 20,
      include: {
        eleve: { select: { id: true, nom: true, prenom: true } },
        groupe: { select: { id: true, nom: true } },
      },
    });

    const profsData = dashboardData.profs.map((p) => ({
      prof: p.prof,
      tauxPourcentage: p.taux,
      totalRecu: p.netRevenue,
      beneficeCentre: p.beneficeCentre,
      salaireProf: p.salaireProf,
      nombreEleves: p.nombreEleves,
    }));

    const totalRecu = dashboardData.netPaidSessionsRevenue;
    const totalBenefice = dashboardData.netCenterEarnings;
    const totalSalaire = totalRecu - totalBenefice;

    const monthlyHistory = await computeMonthlyHistory(centreId, now);

    return NextResponse.json({
      selectedMonth,
      profs: profsData,
      totalRecu,
      totalBenefice,
      totalSalaire,
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

  const [paymentRows, profTauxMap] = await Promise.all([
    prisma.$queryRawUnsafe<{ month: string; prof_id: string | null; recu: number }[]>(
      `
      SELECT TO_CHAR(pa.date_paiement, 'YYYY-MM') AS month, g.prof_id, SUM(pa.montant)::float AS recu
      FROM paiements pa JOIN groupes g ON pa.groupe_id = g.id
      WHERE g.center_id = $1::uuid AND pa.date_paiement >= $2::timestamptz
      GROUP BY TO_CHAR(pa.date_paiement, 'YYYY-MM'), g.prof_id
      `,
      centreId,
      twelveMonthsAgo
    ),
    prisma.utilisateur.findMany({
      where: { role: "prof", centerId: centreId, deletedAt: null },
      select: {
        id: true,
        tauxBenefice: { select: { tauxPourcentage: true } },
      },
    }),
  ]);

  const tauxMap = new Map<string, number>(
    profTauxMap.map((p) => [
      p.id,
      p.tauxBenefice ? Number(p.tauxBenefice.tauxPourcentage) : DEFAULT_CENTER_SHARE,
    ])
  );

  const monthAgg = new Map<string, { recu: number; benefice: number }>();
  for (const r of paymentRows) {
    const agg = monthAgg.get(r.month) ?? { recu: 0, benefice: 0 };
    const recu = Number(r.recu || 0);
    agg.recu += recu;
    const taux = r.prof_id ? (tauxMap.get(r.prof_id) ?? DEFAULT_CENTER_SHARE) : 0;
    agg.benefice += (recu * taux) / 100;
    monthAgg.set(r.month, agg);
  }

  const monthlyHistory: { month: string; totalBenefice: number; totalRecu: number; totalSalaire: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const agg = monthAgg.get(mLabel) ?? { recu: 0, benefice: 0 };
    monthlyHistory.push({
      month: mLabel,
      totalBenefice: agg.benefice,
      totalRecu: agg.recu,
      totalSalaire: agg.recu - agg.benefice,
    });
  }

  return monthlyHistory;
}
