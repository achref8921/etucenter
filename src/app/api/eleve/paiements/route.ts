import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "eleve") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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
