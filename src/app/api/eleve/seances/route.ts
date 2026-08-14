import { NextResponse } from "next/server";
import { requireActiveCenter, ELEVE_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ELEVE_ROLES);
    if (error) return error;

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
          select: {
            id: true,
            nom: true,
            matiere: { select: { id: true, nom: true } },
            prof: { select: { id: true, nom: true, prenom: true, telephone: true, email: true } },
          },
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
