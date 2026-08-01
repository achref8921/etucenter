import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createSystemBackup, BackupBusyError } from "@/lib/backup-service";

export const maxDuration = 300;

const ONE_HOUR = 60 * 60 * 1000;

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
      { error: "CRON_SECRET non configuré sur le serveur. La sauvegarde automatique est désactivée." },
      { status: 500 }
    );
  }

  try {
    const lastAuto = await prisma.systemBackup.findFirst({
      where: { type: "automatique", status: { in: ["ok", "en_cours"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, status: true },
    });

    if (lastAuto && lastAuto.status === "en_cours") {
      return NextResponse.json({ success: false, message: "Une sauvegarde automatique est déjà en cours" }, { status: 409 });
    }

    if (lastAuto && Date.now() - lastAuto.createdAt.getTime() < ONE_HOUR) {
      return NextResponse.json({ success: false, message: "Sauvegarde automatique déjà effectuée récemment" }, { status: 200 });
    }

    const backup = await createSystemBackup({ type: "automatique" });
    return NextResponse.json({ success: true, message: "Sauvegarde automatique terminée", version: backup.version });
  } catch (error: any) {
    if (error instanceof BackupBusyError) {
      return NextResponse.json({ error: "Une sauvegarde est déjà en cours" }, { status: 409 });
    }
    logger.error("Erreur lors de la sauvegarde automatique", { error });
    return NextResponse.json({ error: "Erreur lors de la sauvegarde automatique" }, { status: 500 });
  }
}
