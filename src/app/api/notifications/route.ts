import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { notificationSendSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { sendPushToUsers } from "@/lib/push";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const userId = (session.user as any).id;

    const [notifications, nonLues] = await Promise.all([
      prisma.notification.findMany({
        where: { destinataireId: userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { destinataireId: userId, lu: false },
      }),
    ]);

    return NextResponse.json({ notifications, nonLues });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const senderId = (session.user as any).id;

    const body = await request.json();
    const parsed = notificationSendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { titre, message, destinataires } = parsed.data;

    const destinatairesUniques = [...new Set(destinataires)];

    const eleves = await prisma.utilisateur.findMany({
      where: {
        id: { in: destinatairesUniques },
        centerId,
        role: "eleve",
        deletedAt: null,
      },
      select: { id: true },
    });

    if (eleves.length === 0) {
      return NextResponse.json(
        { error: "Aucun élève valide trouvé dans ce centre" },
        { status: 400 }
      );
    }

    const eleveIds = eleves.map((e) => e.id);
    const invalides = destinatairesUniques.filter((id) => !eleveIds.includes(id));
    if (invalides.length > 0) {
      return NextResponse.json(
        { error: "Certains élèves ne font pas partie de votre centre" },
        { status: 400 }
      );
    }

    await prisma.notification.createMany({
      data: eleveIds.map((destinataireId) => ({
        centerId,
        destinataireId,
        titre: titre.trim(),
        message: message.trim(),
        type: "message_admin",
      })),
    });

    sendPushToUsers(eleveIds, {
      title: titre.trim(),
      body: message.trim(),
      url: "/eleve/notifications",
    }).catch(() => {});

    logger.info("Notifications envoyées par un admin", {
      senderId,
      count: eleveIds.length,
      titre: titre.trim(),
    });

    return NextResponse.json(
      { success: true, count: eleveIds.length },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Erreur lors de l'envoi de notifications", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const body = await request.json();
    const { id, toutMarquer } = body;
    const userId = (session.user as any).id;

    if (toutMarquer) {
      await prisma.notification.updateMany({
        where: { destinataireId: userId, lu: false },
        data: { lu: true },
      });
      return NextResponse.json({ message: "Tout marqué comme lu" });
    }

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: { id, destinataireId: userId },
      data: { lu: true },
    });

    return NextResponse.json({ message: "Notification lue" });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await prisma.notification.deleteMany({
        where: { id, destinataireId: userId },
      });
    } else {
      await prisma.notification.deleteMany({
        where: { destinataireId: userId },
      });
    }

    return NextResponse.json({ message: "Supprimé" });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
