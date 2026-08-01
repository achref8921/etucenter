import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const { eleveId, groupeId } = body;

    if (!eleveId || !groupeId) {
      return NextResponse.json(
        { error: "eleveId et groupeId sont requis" },
        { status: 400 }
      );
    }

    const centreId = (session.user as any).centerId;

    const [eleve, groupe] = await Promise.all([
      prisma.utilisateur.findUnique({ where: { id: eleveId, role: "eleve", centerId: centreId } }),
      prisma.groupe.findUnique({ where: { id: groupeId, centerId: centreId } }),
    ]);

    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }
    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const existingInscription = await prisma.inscription.findUnique({
      where: { eleveId_groupeId: { eleveId, groupeId } },
    });

    if (existingInscription) {
      if (existingInscription.statut === "actif") {
        return NextResponse.json(
          { error: "Cet élève est déjà inscrit dans ce groupe" },
          { status: 409 }
        );
      }

      const inscription = await prisma.inscription.update({
        where: { id: existingInscription.id },
        data: { statut: "actif" },
        include: {
          eleve: {
            select: { id: true, nom: true, prenom: true },
          },
          groupe: {
            select: { id: true, nom: true },
          },
        },
      });

      logger.info("Inscription réactivée", {
        adminId: (session.user as any).id,
        inscriptionId: inscription.id,
        eleveId,
        groupeId,
      });

      return NextResponse.json(inscription, { status: 201 });
    }

    if (groupe.capaciteMax) {
      const currentCount = await prisma.inscription.count({
        where: { groupeId, statut: "actif" },
      });

      if (currentCount >= groupe.capaciteMax) {
        return NextResponse.json(
          { error: "Le groupe a atteint sa capacité maximale" },
          { status: 400 }
        );
      }
    }

    const inscription = await prisma.inscription.create({
      data: { eleveId, groupeId },
      include: {
        eleve: {
          select: { id: true, nom: true, prenom: true },
        },
        groupe: {
          select: { id: true, nom: true },
        },
      },
    });

    logger.info("Inscription créée", {
      adminId: (session.user as any).id,
      inscriptionId: inscription.id,
      eleveId,
      groupeId,
    });

    return NextResponse.json(inscription, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de l'inscription", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const eleveId = searchParams.get("eleveId");
    const groupeId = searchParams.get("groupeId");

    const centreId = (session.user as any).centerId;

    let inscription;

    if (id) {
      inscription = await prisma.inscription.findFirst({
        where: { id, groupe: { centerId: centreId } },
      });
    } else if (eleveId && groupeId) {
      inscription = await prisma.inscription.findFirst({
        where: { eleveId, groupeId, groupe: { centerId: centreId } },
      });
    } else {
      return NextResponse.json(
        { error: "Paramètre id ou (eleveId et groupeId) requis" },
        { status: 400 }
      );
    }

    if (!inscription) {
      return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
    }

    await prisma.inscription.update({
      where: { id: inscription.id },
      data: { statut: "inactif" },
    });

    logger.info("Inscription supprimée", {
      adminId: (session.user as any).id,
      inscriptionId: inscription.id,
      eleveId: inscription.eleveId,
      groupeId: inscription.groupeId,
    });

    return NextResponse.json({ message: "Inscription supprimée avec succès" });
  } catch (error) {
    logger.error("Erreur lors de la suppression de l'inscription", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
