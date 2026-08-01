import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { restoreSystemBackup, BackupRestoreError } from "@/lib/backup-service";

export const maxDuration = 300;

const RESTORE_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 3 };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rl = rateLimit(getRateLimitKey(request, "backup-restore"), RESTORE_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de restaurations. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== true) {
      return NextResponse.json({ error: "Confirmation requise pour restaurer la base de données" }, { status: 400 });
    }

    const result = await restoreSystemBackup({ id, actorId: (session.user as any).id });

    return NextResponse.json({ success: true, message: `Base de données restaurée (version ${result.version})`, ...result });
  } catch (error: any) {
    logger.error("Erreur lors de la restauration de la sauvegarde", { error });
    if (error instanceof BackupRestoreError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur lors de la restauration de la base de données" }, { status: 500 });
  }
}
