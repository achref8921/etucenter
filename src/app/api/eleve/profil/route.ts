import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ELEVE_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isValidImageDataUrl, sanitizeImageValue } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ELEVE_ROLES);
    if (error) return error;

    const profil = await prisma.utilisateur.findUnique({
      where: { id: (session.user as any).id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        niveau: true,
        classe: true,
        filiere: true,
        role: true,
        image: true,
        dateNaissance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profil) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    logger.info("Profil élève récupéré", { eleveId: (session.user as any).id });

    return NextResponse.json(profil);
  } catch (error) {
    logger.error("Erreur lors de la récupération du profil", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ELEVE_ROLES);
    if (error) return error;

    const body = await request.json();
    const { nom, prenom, telephone, image, niveau, classe, filiere, email, motDePasse, ancienMotDePasse } = body;

    const userId = (session.user as any).id;
    const data: Record<string, any> = {};
    if (nom !== undefined) data.nom = nom;
    if (prenom !== undefined) data.prenom = prenom;
    if (telephone !== undefined) data.telephone = telephone;
    if (image !== undefined) {
      if (image !== null && image !== "" && !isValidImageDataUrl(image) && !/^https?:\/\//i.test(String(image).trim())) {
        return NextResponse.json({ error: "Image invalide" }, { status: 400 });
      }
      data.image = sanitizeImageValue(image);
    }

    if (email !== undefined && email !== (session.user as any).email) {
      const trimmedEmail = String(email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return NextResponse.json({ error: "Email invalide" }, { status: 400 });
      }
      const existing = await prisma.utilisateur.findFirst({
        where: { email: trimmedEmail, deletedAt: null },
      });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
      }
      data.email = trimmedEmail;
    }

    if (motDePasse) {
      if (!ancienMotDePasse) {
        return NextResponse.json({ error: "L'ancien mot de passe est requis" }, { status: 400 });
      }

      const user = await prisma.utilisateur.findUnique({
        where: { id: userId },
        select: { motDePasse: true },
      });

      if (!user || !user.motDePasse) {
        return NextResponse.json({ error: "Compte sans mot de passe" }, { status: 400 });
      }

      const isValid = await bcrypt.compare(ancienMotDePasse, user.motDePasse);
      if (!isValid) {
        return NextResponse.json({ error: "Ancien mot de passe incorrect" }, { status: 400 });
      }

      if (motDePasse.length < 6) {
        return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
      }

      data.motDePasse = await bcrypt.hash(motDePasse, 10);
    }

    const validNiveaux = ["primaire", "college", "lycee"];
    const validFilieres = ["informatique", "maths", "economie", "lettres", "sciences"];

    if (niveau !== undefined || classe !== undefined || filiere !== undefined) {
      const current = await prisma.utilisateur.findUnique({
        where: { id: (session.user as any).id },
        select: { niveau: true, classe: true, filiere: true },
      });

      const finalNiveau = niveau !== undefined ? niveau : current?.niveau ?? null;
      const finalClasse = classe !== undefined ? classe : current?.classe ?? null;
      const finalFiliere = filiere !== undefined ? filiere : current?.filiere ?? null;

      if (!finalNiveau || !validNiveaux.includes(finalNiveau)) {
        return NextResponse.json({ error: "Niveau scolaire invalide" }, { status: 400 });
      }
      if (!finalClasse || typeof finalClasse !== "string" || finalClasse.trim().length === 0) {
        return NextResponse.json({ error: "Classe requise" }, { status: 400 });
      }
      const classesLycee = ["2ème", "3ème", "Bac"];
      if (finalNiveau === "lycee" && classesLycee.includes(finalClasse) && !validFilieres.includes(finalFiliere)) {
        return NextResponse.json({ error: "Filière requise pour ce niveau" }, { status: 400 });
      }
      if (finalFiliere && !validFilieres.includes(finalFiliere)) {
        return NextResponse.json({ error: "Filière invalide" }, { status: 400 });
      }

      data.niveau = finalNiveau;
      data.classe = finalClasse ?? null;
      data.filiere = finalFiliere && validFilieres.includes(finalFiliere) ? finalFiliere : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 });
    }

    const profil = await prisma.utilisateur.update({
      where: { id: (session.user as any).id },
      data,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        niveau: true,
        classe: true,
        filiere: true,
        role: true,
        image: true,
        dateNaissance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info("Profil élève mis à jour", { eleveId: (session.user as any).id });

    return NextResponse.json(profil);
  } catch (error) {
    logger.error("Erreur lors de la mise à jour du profil", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
