import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { finalizePassedSeances } from "@/lib/seance-finalizer";

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

  try {
    const count = await finalizePassedSeances();
    return NextResponse.json({ success: true, finalized: count, runAt: new Date().toISOString() });
  } catch (error: any) {
    logger.error("Erreur lors de la finalisation automatique des séances", { error });
    return NextResponse.json({ error: "Erreur lors de la finalisation des séances" }, { status: 500 });
  }
}
