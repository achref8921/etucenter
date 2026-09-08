import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { groupeSchema } from "@/lib/validations";
import {
  computeGroupeDeleteImpact,
  deleteGroupeWithFinancialControl,
  hasSensitiveGroupeImpact,
} from "@/lib/groupe-impact";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
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
          select: { inscriptions: { where: { statut: "actif" } } },
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
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = groupeSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la création de groupe", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const {
      nom,
      description,
      profId,
      matiereId,
      prixParSeance,
      forfaitMontant,
      forfaitSeances,
      capaciteMax,
    } = parsed.data;

    const effectivePrixParSeance =
      forfaitMontant && forfaitSeances
        ? Math.round((forfaitMontant / forfaitSeances) * 100) / 100
        : (prixParSeance as number);

    const groupe = await prisma.groupe.create({
      data: {
        centerId: (session.user as any).centerId,
        nom,
        description: description ?? null,
        profId: profId ?? null,
        matiereId: matiereId ?? null,
        prixParSeance: effectivePrixParSeance,
        forfaitMontant: forfaitMontant ?? null,
        forfaitSeances: forfaitSeances ?? null,
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
          select: { inscriptions: { where: { statut: "actif" } } },
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
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const { id, nom, description, profId, matiereId, prixParSeance, forfaitMontant, forfaitSeances, capaciteMax } = body;

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    const existing = await prisma.groupe.findUnique({ where: { id } });
    if (!existing || existing.centerId !== (session.user as any).centerId) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const data: Record<string, any> = {};
    if (nom !== undefined) data.nom = nom;
    if (description !== undefined) data.description = description;
    if (profId !== undefined) data.profId = profId || null;
    if (matiereId !== undefined) data.matiereId = matiereId || null;
    if (capaciteMax !== undefined) data.capaciteMax = capaciteMax;

    const hasForfait = forfaitMontant !== undefined || forfaitSeances !== undefined;
    if (hasForfait) {
      if (
        typeof forfaitMontant !== "number" ||
        typeof forfaitSeances !== "number" ||
        forfaitMontant <= 0 ||
        forfaitSeances <= 0 ||
        !Number.isInteger(forfaitSeances)
      ) {
        return NextResponse.json(
          { error: "Montant et nombre de séances du forfait requis (entiers positifs)" },
          { status: 400 }
        );
      }
      data.forfaitMontant = forfaitMontant;
      data.forfaitSeances = forfaitSeances;
      data.prixParSeance = Math.round((forfaitMontant / forfaitSeances) * 100) / 100;
    } else if (prixParSeance !== undefined) {
      if (typeof prixParSeance !== "number" || prixParSeance <= 0) {
        return NextResponse.json({ error: "Prix par séance invalide" }, { status: 400 });
      }
      data.prixParSeance = prixParSeance;
      data.forfaitMontant = null;
      data.forfaitSeances = null;
    }

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
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const admin = session.user as any;
    const centerId = admin.centerId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis" }, { status: 400 });
    }

    const existingGroupe = await prisma.groupe.findUnique({ where: { id } });
    if (!existingGroupe || existingGroupe.centerId !== centerId) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const impact = await computeGroupeDeleteImpact(centerId, id);

    if (hasSensitiveGroupeImpact(impact)) {
      const body = await request.json().catch(() => ({}));
      const { mode, motDePasse } = body;

      if (mode !== "only" && mode !== "full") {
        return NextResponse.json(
          {
            error: "Choix requis : 'only' (supprimer le groupe uniquement) ou 'full' (supprimer et effacer l'impact financier)",
            impact,
          },
          { status: 400 }
        );
      }

      if (!motDePasse) {
        return NextResponse.json(
          { error: "Le mot de passe est requis pour confirmer la suppression", impact },
          { status: 400 }
        );
      }

      const user = await prisma.utilisateur.findUnique({ where: { id: admin.id } });
      if (!user || !user.motDePasse) {
        return NextResponse.json({ error: "Compte sans mot de passe" }, { status: 400 });
      }

      const isValid = await bcrypt.compare(motDePasse, user.motDePasse);
      if (!isValid) {
        return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
      }

      await deleteGroupeWithFinancialControl(id, mode, centerId, admin.id);

      logger.info("Groupe supprimé (avec contrôle de l'impact financier)", {
        adminId: admin.id,
        deletedGroupId: id,
        mode,
        impact,
      });

      return NextResponse.json({
        message:
          mode === "full"
            ? "Groupe supprimé et traces financières effacées"
            : "Groupe supprimé (opérations financières conservées)",
        impact,
      });
    }

    await prisma.groupe.delete({ where: { id } });

    logger.info("Groupe supprimé", { adminId: admin.id, deletedGroupId: id });

    return NextResponse.json({ message: "Groupe supprimé avec succès" });
  } catch (error) {
    logger.error("Erreur lors de la suppression du groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
