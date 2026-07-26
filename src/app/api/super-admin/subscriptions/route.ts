import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { centerId, montant, duree, notes } = body;

    if (!centerId || !montant || !duree) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center) {
      return NextResponse.json({ error: "Centre introuvable" }, { status: 404 });
    }

    const now = new Date();
    const dateFin = new Date(now);
    if (duree === "month") {
      dateFin.setMonth(dateFin.getMonth() + 1);
    } else if (duree === "quarter") {
      dateFin.setMonth(dateFin.getMonth() + 3);
    } else if (duree === "year") {
      dateFin.setFullYear(dateFin.getFullYear() + 1);
    }

    const subscription = await prisma.centerSubscription.create({
      data: {
        centerId,
        montant: Number(montant),
        dateDebut: now,
        dateFin,
        statut: "active",
        notes: notes || null,
      },
    });

    await prisma.systemLog.create({
      data: {
        action: "subscription_created",
        entity: "Center",
        entityId: centerId,
        details: { centerName: center.name, montant, duree, dateFin: dateFin.toISOString() },
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error("Create subscription error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
