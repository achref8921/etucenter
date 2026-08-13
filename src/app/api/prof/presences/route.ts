import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { presenceSchema } from "@/lib/validations";
import { canModifyAttendance, clientNowFromOffset } from "@/lib/utils";
import { consumeCourseAttendance, reverseCourseAttendance } from "@/lib/student-finance";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const seanceId = searchParams.get("seanceId");

    if (!seanceId) {
      return NextResponse.json({ error: "Paramètre seanceId requis" }, { status: 400 });
    }

    const timezoneOffset = Number(searchParams.get("timezoneOffset") ?? "0");
    const clientNow = clientNowFromOffset(timezoneOffset);

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

    const [inscriptions, existingPresences] = await Promise.all([
      prisma.inscription.findMany({
        where: { groupeId: seance.groupe.id, statut: "actif" },
        include: {
          eleve: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      }),
      prisma.presence.findMany({
        where: { seanceId },
        include: {
          eleve: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      }),
    ]);

    const presences = inscriptions.map((ins) => {
      const existing = existingPresences.find((p) => p.eleveId === ins.eleveId);
      if (existing) return existing;
      return {
        id: null,
        seanceId,
        eleveId: ins.eleve.id,
        statut: null,
        dateCreation: null,
        eleve: ins.eleve,
      };
    });

    presences.sort((a, b) => `${a.eleve.nom} ${a.eleve.prenom}`.localeCompare(`${b.eleve.nom} ${b.eleve.prenom}`));

    const canModify = canModifyAttendance(seance.date, seance.heureDebut, seance.heureFin, clientNow);

    logger.info("Présences récupérées", { profId: (session.user as any).id, seanceId, count: presences.length });

    return NextResponse.json({ presences, canModify });
  } catch (error) {
    logger.error("Erreur lors de la récupération des présences", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = presenceSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour l'enregistrement des présences", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { seanceId, presences, timezoneOffset } = parsed.data;
    const userId = (session.user as any).id;
    const clientNow = clientNowFromOffset(timezoneOffset);

    const seance = await prisma.seance.findUnique({
      where: { id: seanceId },
      select: {
        id: true,
        date: true,
        heureDebut: true,
        heureFin: true,
        statut: true,
        groupe: {
          select: {
            id: true,
            profId: true,
            centerId: true,
            prixParSeance: true,
          },
        },
      },
    });

    if (!seance) {
      return NextResponse.json({ error: "Séance non trouvée" }, { status: 404 });
    }

    if (seance.groupe.profId !== userId) {
      return NextResponse.json({ error: "Vous n'êtes pas le prof de ce groupe" }, { status: 403 });
    }

    const existingPresences = await prisma.presence.findMany({
      where: { seanceId },
    });

    const activeInscriptions = await prisma.inscription.findMany({
      where: { groupeId: seance.groupe.id, statut: "actif" },
      select: { eleveId: true },
    });
    const activeEleveIds = new Set(activeInscriptions.map((i) => i.eleveId));

    const results = await prisma.$transaction(async (tx) => {
      const out: any[] = [];

      for (const presence of presences as any[]) {
        const existing = existingPresences.find((p: any) => p.eleveId === presence.eleveId);

        if (!activeEleveIds.has(presence.eleveId)) {
          logger.warn("Tentative d'enregistrement d'une présence pour un élève non inscrit activement", {
            profId: userId,
            eleveId: presence.eleveId,
            seanceId,
          });
          out.push(existing ?? null);
          continue;
        }

        let saved: any;

        if (existing) {
          if (!canModifyAttendance(seance.date, seance.heureDebut, seance.heureFin, clientNow)) {
            logger.warn("Tentative de modification de présence en dehors de la fenêtre autorisée", {
              profId: userId,
              presenceId: existing.id,
            });
            out.push(existing);
            continue;
          }

          saved = await tx.presence.update({
            where: { id: existing.id },
            data: {
              statut: presence.statut,
              dateModification: new Date(),
            },
          });
        } else {
          if (!canModifyAttendance(seance.date, seance.heureDebut, seance.heureFin, clientNow)) {
            out.push(null);
            continue;
          }

          saved = await tx.presence.create({
            data: {
              seanceId,
              eleveId: presence.eleveId,
              statut: presence.statut,
              enregistrePar: userId,
            },
          });
        }

        if (presence.statut === "present") {
          await consumeCourseAttendance(
            {
              centerId: seance.groupe.centerId,
              eleveId: presence.eleveId,
              attendanceId: saved.id,
              actorId: userId,
            },
            tx
          );
        } else if (presence.statut === "absent") {
          await reverseCourseAttendance(
            {
              centerId: seance.groupe.centerId,
              eleveId: presence.eleveId,
              attendanceId: saved.id,
              actorId: userId,
            },
            tx
          );
        }

        out.push(saved);
      }

      return out;
    });

    logger.info("Présences enregistrées", {
      profId: userId,
      seanceId,
      count: results.length,
    });

    return NextResponse.json(results);
  } catch (error) {
    logger.error("Erreur lors de l'enregistrement des présences", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
