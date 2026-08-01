import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { utilisateurSchema } from "@/lib/validations";
import { generateRandomCode, generateProfCode } from "@/lib/utils";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const currentUserId = (session.user as any).id;

    const utilisateurs = await prisma.utilisateur.findMany({
      where: { centerId, id: { not: currentUserId }, deletedAt: null },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        actif: true,
        codeEleve: true,
        codeProf: true,
        image: true,
        niveau: true,
        classe: true,
        filiere: true,
        dateNaissance: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    logger.info("Liste des utilisateurs récupérée", { adminId: (session.user as any).id, count: utilisateurs.length });

    return NextResponse.json(utilisateurs);
  } catch (error) {
    logger.error("Erreur lors de la récupération des utilisateurs", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = utilisateurSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la création d'utilisateur", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { nom, prenom, email, motDePasse, telephone, role, dateNaissance, niveau, classe, filiere } = parsed.data;

    const existingUser = await prisma.utilisateur.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Un utilisateur avec cet email existe déjà" }, { status: 409 });
    }

    const data: any = {
      centerId: (session.user as any).centerId,
      nom,
      prenom,
      email,
      role,
      telephone: telephone ?? null,
      dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
      niveau: role === "eleve" ? (niveau ?? null) : null,
      classe: role === "eleve" ? (classe ?? null) : null,
      filiere: role === "eleve" ? (filiere ?? null) : null,
    };

    if (motDePasse) {
      data.motDePasse = await bcrypt.hash(motDePasse, 12);
    }

    if (role === "eleve") {
      let code: string;
      let exists = true;
      while (exists) {
        code = generateRandomCode();
        const found = await prisma.utilisateur.findFirst({ where: { codeEleve: code, centerId: (session.user as any).centerId } });
        exists = !!found;
      }
      data.codeEleve = code!;
    }

    if (role === "prof") {
      let code: string;
      let exists = true;
      while (exists) {
        code = generateProfCode();
        const found = await prisma.utilisateur.findFirst({ where: { codeProf: code, centerId: (session.user as any).centerId } });
        exists = !!found;
      }
      data.codeProf = code!;
    }

    const utilisateur = await prisma.utilisateur.create({
      data,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        actif: true,
        codeEleve: true,
        codeProf: true,
        image: true,
        niveau: true,
        classe: true,
        filiere: true,
        dateNaissance: true,
        createdAt: true,
      },
    });

    logger.info("Utilisateur créé", { adminId: (session.user as any).id, userId: utilisateur.id, email: utilisateur.email });

    return NextResponse.json(utilisateur, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de l'utilisateur", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const { id, actif, motDePasse } = body;

    if (!id) {
      return NextResponse.json({ error: "id est requis" }, { status: 400 });
    }

    if (actif === undefined && motDePasse === undefined) {
      return NextResponse.json({ error: "actif ou motDePasse requis" }, { status: 400 });
    }

    if (motDePasse !== undefined && (typeof motDePasse !== "string" || motDePasse.length < 8)) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }

    const user = await prisma.utilisateur.findUnique({ where: { id } });
    if (!user || user.centerId !== (session.user as any).centerId) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (user.role === "admin" && (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Seul un super admin peut modifier un admin" }, { status: 403 });
    }

    if (motDePasse !== undefined && (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Seul un super admin peut réinitialiser le mot de passe" }, { status: 403 });
    }

    const data: any = {};
    if (actif !== undefined) data.actif = actif;
    if (actif === true) data.deletedAt = null;
    if (motDePasse) {
      data.motDePasse = await bcrypt.hash(motDePasse, 12);
      data.passwordResetToken = null;
      data.passwordResetExpiry = null;
    }

    const updated = await prisma.utilisateur.update({
      where: { id },
      data,
      select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
    });

    if (motDePasse) {
      logger.info("Mot de passe réinitialisé par l'admin", {
        adminId: (session.user as any).id,
        userId: id,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
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

    const currentUserId = (session.user as any).id;

    if (id === currentUserId) {
      return NextResponse.json({ error: "Vous ne pouvez pas archiver votre propre compte" }, { status: 403 });
    }

    const existingUser = await prisma.utilisateur.findUnique({ where: { id } });
    if (!existingUser || existingUser.centerId !== (session.user as any).centerId) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (existingUser.role === "admin" && (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Seul un super admin peut supprimer un admin" }, { status: 403 });
    }

    // Suppression douce (archivage) : les données liées (inscriptions, paiements,
    // présences, notifications) sont conservées, l'utilisateur ne peut plus se connecter.
    await prisma.utilisateur.update({
      where: { id },
      data: { deletedAt: new Date(), actif: false },
    });

    logger.info("Utilisateur archivé (suppression douce)", { adminId: currentUserId, archivedUserId: id });

    return NextResponse.json({ message: "Utilisateur archivé avec succès. Ses données (inscriptions, paiements, présences) sont conservées." });
  } catch (error) {
    logger.error("Erreur lors de la suppression de l'utilisateur", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
