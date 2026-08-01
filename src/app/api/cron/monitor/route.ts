import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { runMonitorCheck } from "@/lib/monitor-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
      { error: "CRON_SECRET non configuré sur le serveur. Le monitoring automatique est désactivé." },
      { status: 500 }
    );
  }

  try {
    const result = await runMonitorCheck({ silent: true });
    if (result.results.length === 0) {
      return NextResponse.json({ success: false, message: "Monitoring désactivé ou déjà en cours" }, { status: 200 });
    }
    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      alertSent: result.alertSent,
      recoverySent: result.recoverySent,
      results: result.results,
    });
  } catch (error: any) {
    logger.error("Erreur lors du cycle de monitoring automatique", { error });
    return NextResponse.json({ error: "Erreur lors du monitoring automatique" }, { status: 500 });
  }
}
