import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { runSubscriptionReminders } from "@/lib/subscription-service";

export const maxDuration = 60;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const result = await runSubscriptionReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error("Erreur lors du cycle de rappels d'abonnement", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
