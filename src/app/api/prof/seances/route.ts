import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { seanceSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "prof") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "prof") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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

    return NextResponse.json(seance, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de la séance", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
