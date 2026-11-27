import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { runSubscriptionReminders } from "@/lib/subscription-service";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = secret ? authHeader === `Bearer ${secret}` : false;

  let isSuperAdmin = false;
  if (!isCron) {
    const session = await getServerSession(authOptions);
    isSuperAdmin = !!session?.user && (session.user as any).role === "super_admin";
  }

  if (!isCron && !isSuperAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!isSuperAdmin && !secret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET non configuré sur le serveur. Les rappels automatiques d'abonnement sont désactivés.",
      },
      { status: 500 }
    );
  }

  try {
    const result = await runSubscriptionReminders();
    return NextResponse.json({
      success: true,
      ...result,
      runAt: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Erreur lors du cron des rappels d'abonnement", { error });
    return NextResponse.json({ error: "Erreur lors des rappels d'abonnement" }, { status: 500 });
  }
}
