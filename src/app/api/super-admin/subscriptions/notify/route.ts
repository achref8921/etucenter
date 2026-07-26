import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiringSubscriptions = await prisma.centerSubscription.findMany({
      where: {
        statut: "active",
        dateFin: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        center: {
          select: {
            id: true,
            name: true,
            utilisateurs: {
              where: { role: "admin" },
              select: { id: true },
            },
          },
        },
      },
    });

    let notificationsCreated = 0;

    for (const sub of expiringSubscriptions) {
      const daysLeft = Math.ceil((sub.dateFin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      for (const admin of sub.center.utilisateurs) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            destinataireId: admin.id,
            type: "subscription_expiring",
            createdAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            },
          },
        });

        if (!existingNotification) {
          await prisma.notification.create({
            data: {
              centerId: sub.centerId,
              destinataireId: admin.id,
              titre: "Abonnement expire bientôt",
              message: `Votre abonnement pour ${sub.center.name} expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""} (${sub.dateFin.toLocaleDateString("fr-FR")}). Montant: ${Number(sub.montant).toLocaleString("fr-TN")} DT.`,
              type: "subscription_expiring",
            },
          });
          notificationsCreated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      expiringCount: expiringSubscriptions.length,
      notificationsCreated,
    });
  } catch (error) {
    console.error("Subscription notify error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
