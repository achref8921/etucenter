import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const centerId = searchParams.get("centerId") || "";
    const statut = searchParams.get("statut") || "TOUS";

    const where: any = { role: { not: "super_admin" } };

    if (role && role !== "super_admin") where.role = role;
    if (centerId) where.centerId = centerId;

    if (statut === "ACTIF") {
      where.actif = true;
      where.deletedAt = null;
    } else if (statut === "ARCHIVE") {
      where.deletedAt = { not: null };
    } else if (statut === "INACTIF") {
      where.actif = false;
      where.deletedAt = null;
    }

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: "insensitive" } },
        { prenom: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { codeEleve: { contains: search, mode: "insensitive" } },
        { codeProf: { contains: search, mode: "insensitive" } },
      ];
    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        actif: true,
        deletedAt: true,
        provider: true,
        codeEleve: true,
        codeProf: true,
        centerId: true,
        niveau: true,
        classe: true,
        filiere: true,
        createdAt: true,
        center: { select: { id: true, name: true, active: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json(utilisateurs);
  } catch (error) {
    logger.error("Erreur lors de la récupération des utilisateurs", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { id, actif, motDePasse, email, niveau, classe, filiere } = body;

    if (!id) {
      return NextResponse.json({ error: "id est requis" }, { status: 400 });
    }

    const hasProfileChange =
      email !== undefined || niveau !== undefined || classe !== undefined || filiere !== undefined;

    if (actif === undefined && motDePasse === undefined && !hasProfileChange) {
      return NextResponse.json({ error: "aucun champ à modifier (actif, motDePasse, email, niveau, classe, filiere)" }, { status: 400 });
    }

    if (motDePasse !== undefined && (typeof motDePasse !== "string" || motDePasse.length < 8)) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }

    const user = await prisma.utilisateur.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (user.role === "super_admin") {
      return NextResponse.json({ error: "Impossible de modifier un super admin" }, { status: 403 });
    }

    const data: any = {};
    const details: any = { centerId: user.centerId, email: user.email, actif, motDePasseReset: !!motDePasse };

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
      }
      const newEmail = email.trim();
      if (newEmail !== user.email) {
        const existing = await prisma.utilisateur.findFirst({
          where: { email: newEmail, id: { not: id }, deletedAt: null },
        });
        if (existing) {
          return NextResponse.json({ error: "Un utilisateur avec cet email existe déjà" }, { status: 409 });
        }
        data.email = newEmail;
        details.email = newEmail;
      }
    }

    if (hasProfileChange && user.role === "eleve") {
      const validNiveaux = ["primaire", "college", "lycee"];
      const validFilieres = ["lettres", "economique", "informatique", "technique", "sciences", "math"];

      if (niveau !== undefined && !validNiveaux.includes(niveau)) {
        return NextResponse.json({ error: "Niveau scolaire invalide" }, { status: 400 });
      }
      if (classe !== undefined && (typeof classe !== "string" || !classe.trim())) {
        return NextResponse.json({ error: "Classe invalide" }, { status: 400 });
      }
      if (filiere !== undefined && !validFilieres.includes(filiere)) {
        return NextResponse.json({ error: "Filière invalide" }, { status: 400 });
      }

      const finalNiveau = niveau !== undefined ? niveau : user.niveau;
      const finalClasse = classe !== undefined ? classe : user.classe;
      const finalFiliere = filiere !== undefined ? filiere : user.filiere;

      if ((niveau !== undefined || classe !== undefined) && finalNiveau && !finalClasse) {
        return NextResponse.json({ error: "Le niveau et la classe sont requis pour les élèves" }, { status: 400 });
      }
      const lyceeClasses = ["2ème", "3ème", "Bac"];
      if (finalNiveau === "lycee" && finalClasse && lyceeClasses.includes(finalClasse) && !finalFiliere) {
        return NextResponse.json({ error: "La filière est requise pour le lycée (2ème, 3ème, Bac)" }, { status: 400 });
      }

      if (niveau !== undefined) data.niveau = niveau;
      if (classe !== undefined) data.classe = classe;
      if (filiere !== undefined) data.filiere = filiere;
      details.niveau = niveau;
      details.classe = classe;
      details.filiere = filiere;
    }

    if (actif !== undefined) { data.actif = actif; }
    if (actif === true) data.deletedAt = null;
    if (motDePasse) {
      data.motDePasse = await bcrypt.hash(motDePasse, 12);
      data.passwordResetToken = null;
      data.passwordResetExpiry = null;
    }

    const updated = await prisma.utilisateur.update({
      where: { id },
      data,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        actif: true,
        deletedAt: true,
        provider: true,
        codeEleve: true,
        codeProf: true,
        centerId: true,
        niveau: true,
        classe: true,
        filiere: true,
        center: { select: { id: true, name: true, active: true } },
      },
    });

    logger.info("Utilisateur modifié par le super admin", {
      superAdminId: (session.user as any).id,
      userId: id,
      actif,
      motDePasseReset: !!motDePasse,
      profil: hasProfileChange,
    });

    await prisma.systemLog.create({
      data: {
        action: "user_updated_by_superadmin",
        entity: "utilisateur",
        entityId: id,
        details,
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Erreur lors de la mise à jour de l'utilisateur", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
