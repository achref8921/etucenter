import { NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CENTER_SHARE,
  getUnpaidTeacherNet,
  getClaimableTeacherBalance,
} from "@/lib/teacher-finance";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const user = session.user as any;
    const userId = user.id;
    const centerId = user.centerId;

    const [tauxBenefice, groupes, presencesTerminees, unpaidTeacherNet, claimableBalance] =
      await Promise.all([
        prisma.tauxBenefice.findUnique({ where: { profId: userId } }),
        prisma.groupe.findMany({
          where: { profId: userId },
          select: {
            id: true,
            nom: true,
            prixParSeance: true,
            _count: {
              select: {
                inscriptions: { where: { statut: "actif" } },
                seances: true,
              },
            },
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
        getUnpaidTeacherNet(centerId, userId),
        getClaimableTeacherBalance(centerId, userId),
      ]);

    const centreShare = tauxBenefice
      ? Number(tauxBenefice.tauxPourcentage)
      : DEFAULT_CENTER_SHARE;
    const profShare = Math.max(0, Math.min(100, 100 - centreShare));

    const totalEleves = groupes.reduce(
      (sum, g) => sum + g._count.inscriptions,
      0
    );
    const totalSeances = groupes.reduce(
      (sum, g) => sum + g._count.seances,
      0
    );

    return NextResponse.json({
      tauxPourcentage: profShare,
      unpaidTeacherNet,
      claimableBalance,
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
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500 }
    );
  }
}
