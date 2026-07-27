import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const { id } = await params;

    const centreId = (session.user as any).centerId;

    const professeur = await prisma.utilisateur.findUnique({
      where: { id, role: "prof", centerId: centreId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        image: true,
        dateNaissance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!professeur) {
      return NextResponse.json({ error: "Professeur non trouvé" }, { status: 404 });
    }

    const groupes = await prisma.groupe.findMany({
      where: { profId: id, centerId: centreId },
      include: {
        matiere: {
          select: { id: true, nom: true },
        },
        _count: {
          select: { inscriptions: true, seances: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const seances = await prisma.seance.findMany({
      where: {
        groupe: { profId: id },
      },
      include: {
        groupe: {
          select: { id: true, nom: true },
        },
        _count: {
          select: {
            presences: { where: { statut: "present" } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const seancesWithStats = await Promise.all(
      seances.map(async (seance: any) => {
        const totalPresences = await prisma.presence.count({
          where: { seanceId: seance.id },
        });

        return {
          id: seance.id,
          date: seance.date,
          heureDebut: seance.heureDebut,
          heureFin: seance.heureFin,
          statut: seance.statut,
          notes: seance.notes,
          groupe: seance.groupe,
          stats: {
            presentsCount: seance._count.presences,
            totalEleves: totalPresences,
          },
        };
      })
    );

    logger.info("Détails professeur récupérés", {
      adminId: (session.user as any).id,
      professeurId: id,
    });

    return NextResponse.json({ professeur, groupes, seances: seancesWithStats });
  } catch (error) {
    logger.error("Erreur lors de la récupération des détails professeur", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
