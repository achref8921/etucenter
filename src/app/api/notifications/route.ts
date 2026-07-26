import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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
