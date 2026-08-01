import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { groupeSchema } from "@/lib/validations";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const groupes = await prisma.groupe.findMany({
      where: { centerId },
      include: {
        prof: {
          select: { id: true, nom: true, prenom: true },
        },
        matiere: {
          select: { id: true, nom: true },
        },
        _count: {
          select: { inscriptions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    logger.info("Liste des groupes récupérée", { adminId: (session.user as any).id, count: groupes.length });

    return NextResponse.json(groupes);
  } catch (error) {
    logger.error("Erreur lors de la récupération des groupes", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const body = await request.json();
    const parsed = groupeSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la création de groupe", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { nom, description, profId, matiereId, prixParSeance, capaciteMax } = parsed.data;

    const groupe = await prisma.groupe.create({
      data: {
        centerId: (session.user as any).centerId,
        nom,
        description: description ?? null,
        profId: profId ?? null,
        matiereId: matiereId ?? null,
        prixParSeance,
        capaciteMax: capaciteMax ?? null,
      },
      include: {
        prof: {
          select: { id: true, nom: true, prenom: true },
        },
        matiere: {
          select: { id: true, nom: true },
        },
        _count: {
          select: { inscriptions: true },
        },
      },
    });

    logger.info("Groupe créé", { adminId: (session.user as any).id, groupId: groupe.id, nom: groupe.nom });

    return NextResponse.json(groupe, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création du groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const body = await request.json();
    const { id, profId, matiereId, prixParSeance } = body;

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    const existing = await prisma.groupe.findUnique({ where: { id } });
    if (!existing || existing.centerId !== (session.user as any).centerId) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const data: Record<string, any> = {};
    if (profId !== undefined) data.profId = profId || null;
    if (matiereId !== undefined) data.matiereId = matiereId || null;
    if (prixParSeance !== undefined) data.prixParSeance = prixParSeance;

    const updated = await prisma.groupe.update({
      where: { id },
      data,
      include: {
        prof: { select: { id: true, nom: true, prenom: true } },
        matiere: { select: { id: true, nom: true } },
      },
    });

    logger.info("Groupe mis à jour", { adminId: (session.user as any).id, groupId: id });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Erreur lors de la mise à jour du groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis" }, { status: 400 });
    }

    const existingGroupe = await prisma.groupe.findUnique({ where: { id } });
    if (!existingGroupe || existingGroupe.centerId !== (session.user as any).centerId) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    await prisma.groupe.delete({ where: { id } });

    logger.info("Groupe supprimé", { adminId: (session.user as any).id, deletedGroupId: id });

    return NextResponse.json({ message: "Groupe supprimé avec succès" });
  } catch (error) {
    logger.error("Erreur lors de la suppression du groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
