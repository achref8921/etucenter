import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const admins = await prisma.utilisateur.findMany({
      where: { centerId: id, role: "admin" },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        actif: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(admins);
  } catch (error) {
    logger.error("Erreur lors de la récupération des admins", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { email, password, nom, prenom, telephone } = body;

    if (!email || !password || !nom || !prenom) {
      return NextResponse.json({ error: "Email, mot de passe, nom et prénom requis" }, { status: 400 });
    }

    const center = await prisma.center.findUnique({ where: { id } });
    if (!center) {
      return NextResponse.json({ error: "Centre non trouvé" }, { status: 404 });
    }

    const existingEmail = await prisma.utilisateur.findFirst({
      where: { email, deletedAt: null },
    });
    if (existingEmail) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);

    const admin = await prisma.utilisateur.create({
      data: {
        centerId: id,
        nom,
        prenom,
        email,
        motDePasse: hash,
        telephone: telephone || null,
        role: "admin",
        actif: true,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        actif: true,
        createdAt: true,
      },
    });

    logger.info("Admin ajouté au centre", { superAdminId: (session.user as any).id, centerId: id, adminId: admin.id });

    await prisma.systemLog.create({
      data: {
        action: "admin_created",
        entity: "utilisateur",
        entityId: admin.id,
        details: { centerId: id, centerName: center.name, email, nom, prenom },
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de l'admin", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
