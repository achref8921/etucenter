import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createSystemBackup, listSystemBackups, getBackupStats, BackupBusyError } from "@/lib/backup-service";

export const maxDuration = 300;

const MANUAL_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 6 };

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "super_admin") return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireSuperAdmin();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const [backups, stats] = await Promise.all([listSystemBackups(), getBackupStats()]);
    return NextResponse.json({ backups, stats });
  } catch (error: any) {
    logger.error("Erreur lors du listage des sauvegardes", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const rl = rateLimit(getRateLimitKey(request, "backup-create"), MANUAL_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de sauvegardes. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const backup = await createSystemBackup({ type: "manuel", createdBy: (session.user as any).id });
    return NextResponse.json({ success: true, backup }, { status: 201 });
  } catch (error: any) {
    if (error instanceof BackupBusyError) {
      return NextResponse.json({ error: "Une sauvegarde est déjà en cours. Patientez." }, { status: 409 });
    }
    logger.error("Erreur lors de la création de la sauvegarde", { error });
    return NextResponse.json({ error: "Erreur lors de la création de la sauvegarde" }, { status: 500 });
  }
}
