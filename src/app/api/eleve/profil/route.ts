import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ELEVE_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sanitizeImageValue } from "@/lib/utils";

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
        telephone2: true,
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
    const { nom, prenom, telephone, telephone2, image } = body;

    const data: Record<string, string | null> = {};
    if (nom !== undefined) data.nom = nom;
    if (prenom !== undefined) data.prenom = prenom;
    if (telephone !== undefined) data.telephone = telephone;
    if (telephone2 !== undefined) data.telephone2 = telephone2 || null;
    if (image !== undefined) data.image = sanitizeImageValue(image);

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
        telephone2: true,
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
