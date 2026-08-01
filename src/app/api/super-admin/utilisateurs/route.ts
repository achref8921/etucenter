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

    const where: any = {};

    if (role) where.role = role;
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
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (user.role === "super_admin") {
      return NextResponse.json({ error: "Impossible de modifier un super admin" }, { status: 403 });
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
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        actif: true,
        deletedAt: true,
        centerId: true,
        center: { select: { id: true, name: true, active: true } },
      },
    });

    logger.info("Utilisateur modifié par le super admin", {
      superAdminId: (session.user as any).id,
      userId: id,
      actif,
      motDePasseReset: !!motDePasse,
    });

    await prisma.systemLog.create({
      data: {
        action: "user_updated_by_superadmin",
        entity: "utilisateur",
        entityId: id,
        details: { centerId: user.centerId, email: user.email, actif, motDePasseReset: !!motDePasse },
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Erreur lors de la mise à jour de l'utilisateur", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
