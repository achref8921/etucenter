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

    const groupes = await prisma.groupe.findMany({
      where: {
        inscriptions: {
          some: {
            eleveId: (session.user as any).id,
            statut: "actif",
          },
        },
      },
      select: { id: true },
    });

    const groupeIds = groupes.map((g) => g.id);

    if (groupeIds.length === 0) {
      return NextResponse.json([]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const seances = await prisma.seance.findMany({
      where: {
        groupeId: { in: groupeIds },
        date: { gte: today },
      },
      include: {
        groupe: {
          select: { id: true, nom: true },
        },
      },
      orderBy: { date: "asc" },
    });

    logger.info("Séances élève récupérées", {
      eleveId: (session.user as any).id,
      count: seances.length,
    });

    return NextResponse.json(seances);
  } catch (error) {
    logger.error("Erreur lors de la récupération des séances élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
