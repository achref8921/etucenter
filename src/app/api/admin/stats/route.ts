import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAdminStats } from "@/lib/calculations";
import { requireActiveCenter } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const [stats, recentPaiements, totalPaidResult] = await Promise.all([
      getAdminStats(centerId),
      prisma.paiement.findMany({
        take: 10,
        where: { groupe: { centerId } },
        orderBy: { datePaiement: "desc" },
        include: {
          eleve: {
            select: { id: true, nom: true, prenom: true },
          },
          groupe: {
            select: { id: true, nom: true },
          },
        },
      }),
      prisma.paiement.aggregate({
        _sum: { montant: true },
        where: { groupe: { centerId } },
      }),
    ]);

    const totalPaid = Number(totalPaidResult._sum.montant || 0);

    logger.info("Statistiques admin récupérées", { adminId: (session.user as any).id });

    return NextResponse.json({ stats: { ...stats, totalPaid }, recentPaiements });
  } catch (error) {
    logger.error("Erreur lors de la récupération des statistiques", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
