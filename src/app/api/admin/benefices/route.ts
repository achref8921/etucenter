import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CENTER_SHARE } from "@/lib/teacher-finance";

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

    const profs = await prisma.utilisateur.findMany({
      where: { role: "prof", centerId: centreId, deletedAt: null },
      select: {
        id: true,
        nom: true,
        prenom: true,
        tauxBenefice: { select: { tauxPourcentage: true } },
      },
    });

    const profIds = profs.map((p) => p.id);

    const [monthPayments, eleveCounts, historyRows] = await Promise.all([
      profIds.length
        ? prisma.$queryRawUnsafe<{ prof_id: string | null; total: number }[]>(
            `
            SELECT g.prof_id, COALESCE(SUM(pa.montant), 0)::float AS total
            FROM paiements pa JOIN groupes g ON pa.groupe_id = g.id
            WHERE g.center_id = $1::uuid AND pa.date_paiement >= $2::timestamptz AND pa.date_paiement <= $3::timestamptz
            GROUP BY g.prof_id
            `,
            centreId,
            startDate,
            endDate
          )
        : [],
      profIds.length
        ? prisma.$queryRawUnsafe<{ prof_id: string | null; nb: number }[]>(
            `
            SELECT g.prof_id, COUNT(DISTINCT i.eleve_id)::int AS nb
            FROM inscriptions i JOIN groupes g ON i.groupe_id = g.id
            WHERE g.center_id = $1::uuid AND i.statut = 'actif'
            GROUP BY g.prof_id
            `,
            centreId
          )
        : [],
      prisma.$queryRawUnsafe<{ month: string; prof_id: string | null; recu: number }[]>(
        `
        SELECT TO_CHAR(pa.date_paiement, 'YYYY-MM') AS month, g.prof_id, SUM(pa.montant)::float AS recu
        FROM paiements pa JOIN groupes g ON pa.groupe_id = g.id
        WHERE g.center_id = $1::uuid AND pa.date_paiement >= $2::timestamptz
        GROUP BY TO_CHAR(pa.date_paiement, 'YYYY-MM'), g.prof_id
        `,
        centreId,
        new Date(now.getFullYear(), now.getMonth() - 11, 1)
      ),
    ]);

    const monthMap = new Map<string, number>();
    for (const r of monthPayments) monthMap.set(r.prof_id ?? "", Number(r.total || 0));
    const countMap = new Map<string, number>();
    for (const r of eleveCounts) countMap.set(r.prof_id ?? "", Number(r.nb || 0));

    const profsData = profs.map((e) => {
      const taux = e.tauxBenefice ? Number(e.tauxBenefice.tauxPourcentage) : DEFAULT_CENTER_SHARE;
      const totalRecu = monthMap.get(e.id) || 0;
      const beneficeCentre = totalRecu * taux / 100;
      const salaireProf = totalRecu - beneficeCentre;

      return {
        prof: { id: e.id, nom: e.nom, prenom: e.prenom },
        tauxPourcentage: taux,
        totalRecu,
        beneficeCentre,
        salaireProf,
        nombreEleves: countMap.get(e.id) || 0,
      };
    });

    const totalRecu = profsData.reduce((s, e) => s + e.totalRecu, 0);
    const totalBenefice = profsData.reduce((s, e) => s + e.beneficeCentre, 0);
    const totalSalaire = profsData.reduce((s, e) => s + e.salaireProf, 0);

    const tauxMap = new Map<string, number>(
      profs.map((p) => [p.id, p.tauxBenefice ? Number(p.tauxBenefice.tauxPourcentage) : DEFAULT_CENTER_SHARE])
    );

    const monthAgg = new Map<string, { recu: number; benefice: number }>();
    for (const r of historyRows) {
      const agg = monthAgg.get(r.month) ?? { recu: 0, benefice: 0 };
      const recu = Number(r.recu || 0);
      agg.recu += recu;
      const taux = r.prof_id ? (tauxMap.get(r.prof_id) ?? DEFAULT_CENTER_SHARE) : 0;
      agg.benefice += recu * taux / 100;
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

    return NextResponse.json({
      selectedMonth,
      profs: profsData,
      totalRecu,
      totalBenefice,
      totalSalaire,
      monthlyHistory,
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
