import { NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CENTER_SHARE, round2 } from "@/lib/teacher-finance";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const user = session.user as any;
    const userId = user.id;
    const centerId = user.centerId;

    const [tauxBenefice, groupes, presencesTerminees, paiementsAgg, gainsAgg] = await Promise.all([
      prisma.tauxBenefice.findUnique({ where: { profId: userId } }),
      prisma.groupe.findMany({
        where: { profId: userId },
        select: {
          id: true,
          nom: true,
          prixParSeance: true,
          _count: { select: { inscriptions: { where: { statut: "actif" } }, seances: true } },
        },
      }),
      prisma.presence.count({
        where: {
          statut: "present",
          seance: {
            groupe: { profId: userId },
            statut: "terminee",
          },
        },
      }),
      prisma.paiement.aggregate({
        where: { groupe: { profId: userId } },
        _sum: { montant: true },
      }),
      prisma.teacherTransaction.aggregate({
        where: { centerId, teacherId: userId, type: "EARNING", status: "active" },
        _sum: { signedAmount: true },
      }),
    ]);

    const centreShare = tauxBenefice ? Number(tauxBenefice.tauxPourcentage) : DEFAULT_CENTER_SHARE;
    const profShare = Math.max(0, Math.min(100, 100 - centreShare));

    const totalRevenuRecu = round2(Number(paiementsAgg._sum.montant || 0));
    const totalRevenuNet = round2(Number(gainsAgg._sum.signedAmount || 0));
    const totalEleves = groupes.reduce((sum, g) => sum + g._count.inscriptions, 0);
    const totalSeances = groupes.reduce((sum, g) => sum + g._count.seances, 0);

    return NextResponse.json({
      tauxPourcentage: profShare,
      totalRevenuRecu,
      totalRevenuNet,
      totalEleves,
      totalSeances,
      totalSeancesTerminees: presencesTerminees,
      groupes: groupes.map((g) => ({
        id: g.id,
        nom: g.nom,
        prixParSeance: Number(g.prixParSeance),
        nbEleves: g._count.inscriptions,
        nbSeances: g._count.seances,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
