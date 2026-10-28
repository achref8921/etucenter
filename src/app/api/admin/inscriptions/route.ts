import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { todayDateInputValue } from "@/lib/utils";

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
      prisma.utilisateur.findUnique({ where: { id: eleveId, role: "eleve", centerId: centreId, deletedAt: null, ghost: false } }),
      prisma.groupe.findUnique({ where: { id: groupeId, centerId: centreId } }),
    ]);

    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }
    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    // Un groupe archivé (scission / fusion) ne peut plus accueillir d'élève :
    // sa période est close et son historique est figé.
    if (groupe.statut === "archive") {
      return NextResponse.json(
        { error: "Ce groupe est archivé : impossible d'y inscrire un élève" },
        { status: 400 }
      );
    }

    // Une inscription est une PÉRIODE [dateDebut, dateFin] : on vérifie qu'il
    // n'existe pas déjà une période OUVERTE pour ce couple élève/groupe.
    // (L'ancien findUnique sur eleveId_groupeId n'existe plus dans le schéma.)
    const openInscription = await prisma.inscription.findFirst({
      where: { eleveId, groupeId, statut: "actif" },
      select: { id: true },
    });

    if (openInscription) {
      return NextResponse.json(
        { error: "Cet élève est déjà inscrit dans ce groupe" },
        { status: 409 }
      );
    }

    // Réinscription : on reprend le dernier forfait connu sans réécrire
    // l'historique (la période fermée reste intacte).
    const previousInscription = await prisma.inscription.findFirst({
      where: { eleveId, groupeId, statut: "inactif" },
      orderBy: { dateDebut: "desc" },
      select: { forfaitMontant: true, forfaitSeances: true },
    });

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
      data: {
        eleveId,
        groupeId,
        statut: "actif",
        forfaitMontant: previousInscription?.forfaitMontant ?? null,
        forfaitSeances: previousInscription?.forfaitSeances ?? null,
        forfaitSetAt: previousInscription?.forfaitMontant != null ? new Date() : null,
      },
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
      data: {
        statut: "inactif",
        // La sortie ferme la période : l'historique (séances, consommations,
        // paiements) reste rattaché à cette période, aucun montant ne change.
        ...(inscription.dateFin
          ? {}
          : {
              dateFin: new Date(`${todayDateInputValue()}T00:00:00.000Z`),
              dateFinSource: "saisie" as const,
            }),
      },
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

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const { id, forfaitMontant, forfaitSeances } = body;

    if (!id) {
      return NextResponse.json({ error: "id est requis" }, { status: 400 });
    }

    const centreId = (session.user as any).centerId;

    const inscription = await prisma.inscription.findFirst({
      where: { id, groupe: { centerId: centreId } },
    });

    if (!inscription) {
      return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
    }

    const updateData: any = {};
    const hasMontant = forfaitMontant !== undefined && forfaitMontant !== "" && forfaitMontant !== null;
    const hasSeances = forfaitSeances !== undefined && forfaitSeances !== "" && forfaitSeances !== null;

    if (hasMontant || hasSeances) {
      updateData.forfaitMontant = Number(forfaitMontant);
      updateData.forfaitSeances = Number(forfaitSeances);
      updateData.forfaitSetAt = new Date();
    } else {
      updateData.forfaitMontant = null;
      updateData.forfaitSeances = null;
      updateData.forfaitSetAt = null;
    }

    const updated = await prisma.inscription.update({
      where: { id: inscription.id },
      data: updateData,
      include: {
        eleve: { select: { id: true, nom: true, prenom: true } },
        groupe: { select: { id: true, nom: true, prixParSeance: true } },
      },
    });

    logger.info("Forfait par élève mis à jour pour l'inscription", {
      adminId: (session.user as any).id,
      inscriptionId: inscription.id,
      eleveId: inscription.eleveId,
      groupeId: inscription.groupeId,
      forfaitMontant: updateData.forfaitMontant ?? null,
      forfaitSeances: updateData.forfaitSeances ?? null,
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("Erreur lors de la mise à jour du forfait de l'inscription", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
