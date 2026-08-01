import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { matiereSchema } from "@/lib/validations";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const matieres = await prisma.matiere.findMany({
      where: { centerId },
      include: {
        _count: {
          select: { groupes: true },
        },
      },
      orderBy: { nom: "asc" },
    });

    logger.info("Liste des matières récupérée", { adminId: (session.user as any).id, count: matieres.length });

    return NextResponse.json(matieres);
  } catch (error) {
    logger.error("Erreur lors de la récupération des matières", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = matiereSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la création de matière", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { nom, description } = parsed.data;

    const existingMatiere = await prisma.matiere.findFirst({ where: { nom, centerId: (session.user as any).centerId } });
    if (existingMatiere) {
      return NextResponse.json({ error: "Une matière avec ce nom existe déjà" }, { status: 409 });
    }

    const matiere = await prisma.matiere.create({
      data: {
        center: { connect: { id: (session.user as any).centerId } },
        nom,
        description: description ?? null,
      },
    });

    logger.info("Matière créée", { adminId: (session.user as any).id, matiereId: matiere.id, nom: matiere.nom });

    return NextResponse.json(matiere, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de la matière", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis" }, { status: 400 });
    }

    const existingMatiere = await prisma.matiere.findUnique({ where: { id } });
    if (!existingMatiere || existingMatiere.centerId !== (session.user as any).centerId) {
      return NextResponse.json({ error: "Matière non trouvée" }, { status: 404 });
    }

    await prisma.matiere.delete({ where: { id } });

    logger.info("Matière supprimée", { adminId: (session.user as any).id, deletedMatiereId: id });

    return NextResponse.json({ message: "Matière supprimée avec succès" });
  } catch (error) {
    logger.error("Erreur lors de la suppression de la matière", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
