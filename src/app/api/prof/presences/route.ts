import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { presenceSchema } from "@/lib/validations";
import { canModifyAttendance } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const seanceId = searchParams.get("seanceId");

    if (!seanceId) {
      return NextResponse.json({ error: "Paramètre seanceId requis" }, { status: 400 });
    }

    const seance = await prisma.seance.findUnique({
      where: { id: seanceId },
      include: {
        groupe: {
          select: { id: true, profId: true },
        },
      },
    });

    if (!seance) {
      return NextResponse.json({ error: "Séance non trouvée" }, { status: 404 });
    }

    if (seance.groupe.profId !== (session.user as any).id) {
      return NextResponse.json({ error: "Vous n'êtes pas le prof de ce groupe" }, { status: 403 });
    }

    const presences = await prisma.presence.findMany({
      where: { seanceId },
      include: {
        eleve: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
      },
      orderBy: { dateCreation: "asc" },
    });

    const canModify = canModifyAttendance(seance.date, seance.heureDebut, seance.heureFin);

    logger.info("Présences récupérées", { profId: (session.user as any).id, seanceId, count: presences.length });

    return NextResponse.json({ presences, canModify });
  } catch (error) {
    logger.error("Erreur lors de la récupération des présences", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const body = await request.json();
    const parsed = presenceSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour l'enregistrement des présences", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { seanceId, presences } = parsed.data;

    const seance = await prisma.seance.findUnique({
      where: { id: seanceId },
      select: {
        id: true,
        date: true,
        heureDebut: true,
        heureFin: true,
        groupe: { select: { id: true, profId: true } },
      },
    });

    if (!seance) {
      return NextResponse.json({ error: "Séance non trouvée" }, { status: 404 });
    }

    if (seance.groupe.profId !== (session.user as any).id) {
      return NextResponse.json({ error: "Vous n'êtes pas le prof de ce groupe" }, { status: 403 });
    }

    const existingPresences = await prisma.presence.findMany({
      where: { seanceId },
    });

    const results = await Promise.all(
      presences.map(async (presence: any) => {
        const existing = existingPresences.find((p: any) => p.eleveId === presence.eleveId);

        if (existing) {
          if (!canModifyAttendance(seance.date, seance.heureDebut, seance.heureFin)) {
            logger.warn("Tentative de modification de présence en dehors de la fenêtre autorisée", {
              profId: (session.user as any).id,
              presenceId: existing.id,
            });
            return existing;
          }

          return prisma.presence.update({
            where: { id: existing.id },
            data: {
              statut: presence.statut,
              dateModification: new Date(),
            },
          });
        }

        if (!canModifyAttendance(seance.date, seance.heureDebut, seance.heureFin)) {
          return null;
        }

        return prisma.presence.create({
          data: {
            seanceId,
            eleveId: presence.eleveId,
            statut: presence.statut,
            enregistrePar: (session.user as any).id,
          },
        });
      })
    );

    logger.info("Présences enregistrées", {
      profId: (session.user as any).id,
      seanceId,
      count: results.length,
    });

    return NextResponse.json(results);
  } catch (error) {
    logger.error("Erreur lors de l'enregistrement des présences", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
