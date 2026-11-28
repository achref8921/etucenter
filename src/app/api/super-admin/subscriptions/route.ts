import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  getSubscriptionOverviews,
  recordSubscriptionPayment,
  SUBSCRIPTION_DURATIONS,
  type SubscriptionDuration,
} from "@/lib/subscription-service";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "super_admin") {
    return false;
  }
  return true;
}

export async function GET() {
  try {
    if (!(await requireSuperAdmin())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const overviews = await getSubscriptionOverviews();
    const summary = {
      totalCenters: overviews.length,
      active: overviews.filter((o) => o.state === "active").length,
      dueSoon: overviews.filter((o) => o.state === "due_soon").length,
      dueToday: overviews.filter((o) => o.state === "due_today").length,
      grace: overviews.filter((o) => o.state === "grace").length,
      overdue: overviews.filter((o) => o.state === "overdue").length,
      suspended: overviews.filter((o) => o.state === "suspended").length,
      withoutSubscription: overviews.filter((o) => o.state === "none").length,
    };

    return NextResponse.json({ overviews, summary, generatedAt: new Date().toISOString() });
  } catch (error) {
    logger.error("Erreur lors de la récupération des abonnements", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireSuperAdmin())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { centerId, montant, duree, notes, paidAt } = body ?? {};

    if (!centerId || montant === undefined || montant === null || !duree) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    if (!SUBSCRIPTION_DURATIONS.includes(duree)) {
      return NextResponse.json(
        { error: "Durée d'abonnement invalide (month, quarter ou year)" },
        { status: 400 }
      );
    }

    const result = await recordSubscriptionPayment({
      centerId: String(centerId),
      montant: Number(montant),
      duree: duree as SubscriptionDuration,
      notes: typeof notes === "string" ? notes : null,
      paidAt: typeof paidAt === "string" && paidAt.trim() ? paidAt.trim() : null,
    });

    const dateLabel = new Date(result.subscription.paidAt).toLocaleDateString("fr-FR", {
      timeZone: "UTC",
    });

    return NextResponse.json(
      {
        ...result,
        message: result.backdated
          ? result.affectsCurrentPeriod
            ? `Paiement antérieur du ${dateLabel} enregistré pour ${result.centerName}. Prochaine échéance dans ${result.daysRemaining} jour${result.daysRemaining > 1 ? "s" : ""}.`
            : `Paiement antérieur du ${dateLabel} enregistré pour ${result.centerName}. Période historique : le compteur actuel n'est pas modifié.`
          : `Paiement enregistré pour ${result.centerName}. Prochaine échéance dans ${result.daysRemaining} jour${result.daysRemaining > 1 ? "s" : ""}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    logger.error("Erreur lors de l'enregistrement d'un abonnement", { error });

    if (message === "Centre introuvable") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message === "Durée d'abonnement invalide" ||
      message === "Montant invalide" ||
      message === "Date de paiement invalide" ||
      message === "La date de paiement ne peut pas être dans le futur"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
