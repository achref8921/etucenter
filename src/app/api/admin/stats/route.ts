import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAdminStats } from "@/lib/calculations";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdminRole((session.user as any).role as string)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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
