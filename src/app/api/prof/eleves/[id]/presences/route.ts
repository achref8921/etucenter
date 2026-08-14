import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const { id } = await params;
    const userId = (session.user as any).id;

    const eleve = await prisma.utilisateur.findFirst({
      where: {
        id,
        role: "eleve",
        deletedAt: null,
        inscriptions: { some: { statut: "actif", groupe: { profId: userId } } },
      },
      select: { id: true, nom: true, prenom: true },
    });

    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const presences = await prisma.presence.findMany({
      where: {
        eleveId: id,
        seance: { groupe: { profId: userId } },
      },
      select: {
        id: true,
        statut: true,
        seance: {
          select: {
            id: true,
            date: true,
            heureDebut: true,
            heureFin: true,
            statut: true,
            prixParSeance: true,
            groupe: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: { seance: { date: "desc" } },
    });

    const sessions = presences.map((p) => ({
      presenceId: p.id,
      statut: p.statut,
      seance: p.seance,
    }));

    logger.info("Historique présences élève récupéré", { profId: userId, eleveId: id, count: sessions.length });

    return NextResponse.json({ eleve, sessions });
  } catch (error) {
    logger.error("Erreur lors de la récupération de l'historique des présences", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
