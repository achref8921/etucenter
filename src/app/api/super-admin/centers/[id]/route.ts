import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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

    const center = await prisma.center.findUnique({
      where: { id },
      include: {
        _count: {
          select: { utilisateurs: true, groupes: true, matieres: true },
        },
      },
    });

    if (!center) {
      return NextResponse.json({ error: "Centre non trouvé" }, { status: 404 });
    }

    return NextResponse.json(center);
  } catch (error) {
    logger.error("Erreur lors de la récupération du centre", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PATCH(
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
    const { active, name, phone, address } = body;

    const center = await prisma.center.findUnique({ where: { id } });
    if (!center) {
      return NextResponse.json({ error: "Centre non trouvé" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof active === "boolean") data.active = active;
    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 });
    }

    const updated = await prisma.center.update({ where: { id }, data });

    logger.info("Centre mis à jour", { superAdminId: (session.user as any).id, centerId: id, changes: data });

    if (typeof active === "boolean" && active !== center.active) {
      await prisma.systemLog.create({
        data: {
          action: active ? "center_activated" : "center_suspended",
          entity: "center",
          entityId: id,
          details: { name: center.name, previousActive: center.active, newActive: active },
          userId: (session.user as any).id,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Erreur lors de la mise à jour du centre", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const center = await prisma.center.findUnique({
      where: { id },
      include: { _count: { select: { utilisateurs: true, groupes: true, matieres: true } } },
    });

    if (!center) {
      return NextResponse.json({ error: "Centre non trouvé" }, { status: 404 });
    }

    const logDetails = {
      name: center.name,
      slug: center.slug,
      usersDeleted: center._count.utilisateurs,
      groupsDeleted: center._count.groupes,
      subjectsDeleted: center._count.matieres,
    };

    await prisma.center.update({ where: { id }, data: { active: false } });

    logger.info("Centre supprimé (désactivé)", { superAdminId: (session.user as any).id, centerId: id });

    await prisma.systemLog.create({
      data: {
        action: "center_deleted",
        entity: "center",
        entityId: id,
        details: logDetails,
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json({ message: "Centre supprimé avec succès" });
  } catch (error) {
    logger.error("Erreur lors de la suppression du centre", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
