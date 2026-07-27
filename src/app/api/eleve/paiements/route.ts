import { NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const paiements = await prisma.paiement.findMany({
      where: { eleveId: (session.user as any).id },
      include: {
        groupe: {
          select: { id: true, nom: true },
        },
      },
      orderBy: { datePaiement: "desc" },
    });

    logger.info("Paiements élève récupérés", {
      eleveId: (session.user as any).id,
      count: paiements.length,
    });

    return NextResponse.json(paiements);
  } catch (error) {
    logger.error("Erreur lors de la récupération des paiements élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
