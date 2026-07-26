import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adminId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id, adminId } = await params;
    const body = await request.json();
    const { actif } = body;

    if (typeof actif !== "boolean") {
      return NextResponse.json({ error: "actif requis (boolean)" }, { status: 400 });
    }

    const admin = await prisma.utilisateur.findFirst({
      where: { id: adminId, centerId: id, role: "admin" },
    });
    if (!admin) {
      return NextResponse.json({ error: "Admin non trouvé" }, { status: 404 });
    }

    const updated = await prisma.utilisateur.update({
      where: { id: adminId },
      data: { actif },
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

    logger.info("Admin mis à jour", { superAdminId: (session.user as any).id, centerId: id, adminId, actif });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Erreur lors de la mise à jour de l'admin", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; adminId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id, adminId } = await params;

    const admin = await prisma.utilisateur.findFirst({
      where: { id: adminId, centerId: id, role: "admin" },
    });
    if (!admin) {
      return NextResponse.json({ error: "Admin non trouvé" }, { status: 404 });
    }

    const adminCount = await prisma.utilisateur.count({
      where: { centerId: id, role: "admin" },
    });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Impossible de supprimer le dernier admin du centre" }, { status: 400 });
    }

    await prisma.utilisateur.delete({ where: { id: adminId } });

    logger.info("Admin supprimé", { superAdminId: (session.user as any).id, centerId: id, adminId });

    await prisma.systemLog.create({
      data: {
        action: "admin_deleted",
        entity: "utilisateur",
        entityId: adminId,
        details: { centerId: id, email: admin.email, nom: admin.nom, prenom: admin.prenom },
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json({ message: "Admin supprimé" });
  } catch (error) {
    logger.error("Erreur lors de la suppression de l'admin", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
