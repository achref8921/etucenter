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

    const presences = await prisma.presence.findMany({
      where: { eleveId: (session.user as any).id },
      include: {
        seance: {
          include: {
            groupe: {
              select: { id: true, nom: true },
            },
          },
        },
      },
      orderBy: { dateCreation: "desc" },
    });

    const historique = presences.map((presence: any) => ({
      id: presence.id,
      statut: presence.statut,
      dateCreation: presence.dateCreation,
      seance: {
        id: presence.seance.id,
        date: presence.seance.date,
        heureDebut: presence.seance.heureDebut,
        heureFin: presence.seance.heureFin,
        statut: presence.seance.statut,
        groupe: presence.seance.groupe,
      },
    }));

    logger.info("Historique présences élève récupéré", { eleveId: (session.user as any).id, count: historique.length });

    return NextResponse.json(historique);
  } catch (error) {
    logger.error("Erreur lors de la récupération de l'historique des présences", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
