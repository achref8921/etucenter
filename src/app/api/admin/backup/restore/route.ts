import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { restoreCenterBackup, validateCenterBackup, BACKUP_KIND } from "@/lib/admin-backup-full";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // limite de 100 Mo pour l'import
const RESTORE_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 5 };

export async function POST(request: Request) {
  try {
    const rl = rateLimit(getRateLimitKey(request, "restore"), RESTORE_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;
    const centerId = (session.user as any).centerId;

    const form = await request.formData();
    const fileField = form.get("file");
    const mode = typeof form.get("mode") === "string" ? (form.get("mode") as string) : "merge";

    if (!fileField || !(fileField instanceof File)) {
      return NextResponse.json({ error: "Fichier de backup manquant" }, { status: 400 });
    }
    if (fileField.size <= 0) {
      return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
    }
    if (fileField.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 100 Mo)" }, { status: 413 });
    }
    if (mode !== "merge" && mode !== "full") {
      return NextResponse.json({ error: "Mode invalide (merge ou full attendu)" }, { status: 400 });
    }

    const text = await fileField.text();
    let dump: any;
    try {
      dump = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Fichier de backup invalide ou corrompu (JSON illisible)" }, { status: 400 });
    }

    const errors = validateCenterBackup(dump);
    if (errors.length > 0) {
      return NextResponse.json({ error: `Fichier de backup invalide : ${errors.join(", ")}` }, { status: 400 });
    }

    const logs: string[] = [];
    logs.push(`Fichier ${BACKUP_KIND} analysé (v${dump.schemaVersion}).`);
    logs.push(`Contenu du backup : ${JSON.stringify(dump.counts || {})}.`);
    if (dump.centerId && dump.centerId !== centerId) {
      logs.push(`Attention : ce backup provient du centre « ${dump.centre || ""} » (un autre centre). L'import se fera dans le centre actuel.`);
    }

    const result = await prisma.$transaction(
      async (tx) => {
        return restoreCenterBackup(tx, centerId, dump, mode);
      },
      { timeout: 180_000 }
    );

    logs.push(...result.logs);

    logger.info("Backup admin restauré", { centerId, mode, created: result.created, skipped: result.skipped, tempPasswords: result.tempPasswords.length });

    return NextResponse.json({
      success: true,
      message: `Import terminé : ${result.created} éléments importés, ${result.skipped} ignorés.`,
      logs,
      mode,
      tempPasswords: result.tempPasswords,
    });
  } catch (error: any) {
    logger.error("Erreur lors de l'import de backup", { error });
    return NextResponse.json(
      { error: "Erreur lors de l'import des données : " + (error?.message || "") },
      { status: 500 }
    );
  }
}
