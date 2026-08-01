import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { runMonitorCheck } from "@/lib/monitor-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const STATUS_RATE_LIMIT = { windowMs: 60_000, max: 10 };

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rl = rateLimit(getRateLimitKey(request, "monitor-status"), STATUS_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de requêtes. Réessayez plus tard." }, { status: 429 });
    }

    const result = await runMonitorCheck({ actorId: (session.user as any).id });
    if (result.results.length === 0) {
      return NextResponse.json({ error: "Monitoring désactivé dans les réglages" }, { status: 400 });
    }

    return NextResponse.json({ success: true, checkedAt: new Date().toISOString(), ...result });
  } catch (error) {
    logger.error("Erreur lors de la vérification de l'état", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
