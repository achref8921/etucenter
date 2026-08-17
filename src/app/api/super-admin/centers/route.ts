import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateCenterCode } from "@/lib/utils";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const centers = await prisma.center.findMany({
      include: {
        _count: {
          select: { utilisateurs: true, groupes: true, matieres: true },
        },
      },
    });

    return NextResponse.json(centers);
  } catch (error) {
    logger.error("Erreur lors de la récupération des centres", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, phone, address, adminEmail, adminPassword, adminNom, adminPrenom } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Center name and slug are required" }, { status: 400 });
    }
    if (!adminEmail || !adminPassword || !adminNom || !adminPrenom) {
      return NextResponse.json({ error: "Admin email, password, first name and last name are required" }, { status: 400 });
    }

    const existing = await prisma.center.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) {
      return NextResponse.json({ error: "A center with this name or slug already exists" }, { status: 409 });
    }

    const existingEmail = await prisma.utilisateur.findFirst({
      where: { email: adminEmail, deletedAt: null },
    });
    if (existingEmail) {
      return NextResponse.json({ error: "This email is already used by another account" }, { status: 409 });
    }

    const hash = await bcrypt.hash(adminPassword, 12);

    let code = generateCenterCode();
    while (await prisma.center.findUnique({ where: { code } })) {
      code = generateCenterCode();
    }

    const center = await prisma.center.create({
      data: {
        name,
        slug,
        code,
        phone: phone ?? null,
        address: address ?? null,
      },
    });

    const admin = await prisma.utilisateur.create({
      data: {
        centerId: center.id,
        nom: adminNom,
        prenom: adminPrenom,
        email: adminEmail,
        motDePasse: hash,
        role: "admin",
        actif: true,
      },
    });

    logger.info("Centre + Admin créés", { superAdminId: (session.user as any).id, centerId: center.id, adminId: admin.id });

    await prisma.systemLog.create({
      data: {
        action: "center_created",
        entity: "center",
        entityId: center.id,
        details: { name, slug, adminEmail },
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json({
      center,
      admin: { id: admin.id, email: admin.email, nom: admin.nom, prenom: admin.prenom },
    }, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création du centre", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
