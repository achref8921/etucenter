import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { seanceSchema } from "@/lib/validations";
import { sendPushToUsers } from "@/lib/push";

function formatDateFr(date: Date): string {
  return new Date(date).toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeFr(time: Date | null): string | null {
  if (!time) return null;
  return new Date(time).toLocaleTimeString("fr-TN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function notifyGroupeStudents(
  centerId: string,
  groupeId: string,
  groupeNom: string,
  titre: string,
  message: string,
  url: string
) {
  const inscriptions = await prisma.inscription.findMany({
    where: { groupeId, statut: "actif" },
    select: { eleveId: true },
  });
  const eleveIds = inscriptions.map((i) => i.eleveId);
  if (eleveIds.length === 0) return;

  await prisma.notification.createMany({
    data: eleveIds.map((destinataireId) => ({
      centerId,
      destinataireId,
      titre,
      message,
      type: "nouvelle_seance",
    })),
  });
  await sendPushToUsers(eleveIds, { title: titre, body: message, url }).catch(() => {});
}

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const groupes = await prisma.groupe.findMany({
      where: { profId: (session.user as any).id },
      select: { id: true },
    });

    const groupeIds = groupes.map((g: any) => g.id);

    const dateFilter: any = {
      groupeId: { in: groupeIds },
    };

    if (dateFrom || dateTo) {
      dateFilter.date = {};
      if (dateFrom) {
        dateFilter.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.date.lte = new Date(dateTo);
      }
    }

    const seances = await prisma.seance.findMany({
      where: dateFilter,
      include: {
        groupe: {
          select: { id: true, nom: true },
        },
        _count: {
          select: { presences: true },
        },
      },
      orderBy: { date: "desc" },
    });

    logger.info("Séances prof récupérées", { profId: (session.user as any).id, count: seances.length });

    return NextResponse.json(seances);
  } catch (error) {
    logger.error("Erreur lors de la récupération des séances", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = seanceSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la création de séance", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { groupeId, date, heureDebut, heureFin, notes } = parsed.data;

    const groupe = await prisma.groupe.findUnique({ where: { id: groupeId } });
    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    if (groupe.profId !== (session.user as any).id) {
      return NextResponse.json({ error: "Vous n'êtes pas le prof de ce groupe" }, { status: 403 });
    }

    const seance = await prisma.seance.create({
      data: {
        groupeId,
        date: new Date(date),
        heureDebut: heureDebut ? new Date(heureDebut) : null,
        heureFin: heureFin ? new Date(heureFin) : null,
        notes: notes ?? null,
        prixParSeance: groupe.prixParSeance ?? null,
      },
      include: {
        groupe: {
          select: { id: true, nom: true },
        },
        _count: {
          select: { presences: true },
        },
      },
    });

    logger.info("Séance créée", { profId: (session.user as any).id, seanceId: seance.id, groupeId });

    const dateStr = formatDateFr(seance.date);
    const timeStr = formatTimeFr(seance.heureDebut);
    const when = timeStr ? `le ${dateStr} à ${timeStr}` : `le ${dateStr}`;
    await notifyGroupeStudents(
      groupe.centerId,
      groupeId,
      groupe.nom,
      "Nouvelle séance prévue",
      `Votre professeur a programmé une séance pour le groupe "${groupe.nom}" ${when}.`,
      "/eleve/notifications"
    );

    return NextResponse.json(seance, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de la séance", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
