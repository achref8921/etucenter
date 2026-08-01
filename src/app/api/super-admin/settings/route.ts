import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getSettingsMap, setSettings, SETTING_KEYS } from "@/lib/settings";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const settings = await getSettingsMap();
    return NextResponse.json({ settings });
  } catch (error) {
    logger.error("Erreur lors de la lecture des réglages", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const incoming = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

    const allowed: Set<string> = new Set(Object.values(SETTING_KEYS));
    const clean: Record<string, string> = {};
    for (const key of Object.keys(incoming)) {
      if (!allowed.has(key)) continue;
      const value = incoming[key];
      if (value === undefined || value === null) continue;
      clean[key] = String(value);
    }

    if (Object.keys(clean).length === 0) {
      return NextResponse.json({ error: "Aucun réglage valide fourni" }, { status: 400 });
    }

    if (clean[SETTING_KEYS.backupRetention] !== undefined) {
      const n = parseInt(clean[SETTING_KEYS.backupRetention], 10);
      if (!Number.isFinite(n) || n < 1 || n > 365) {
        return NextResponse.json({ error: "La rétention des sauvegardes doit être entre 1 et 365 jours" }, { status: 400 });
      }
    }

    for (const key of [SETTING_KEYS.maintenanceMode, SETTING_KEYS.openRegistration]) {
      if (clean[key] !== undefined) clean[key] = clean[key] === "true" ? "true" : "false";
    }

    await setSettings(clean);

    logger.info("Réglages de la plateforme mis à jour", {
      superAdminId: (session.user as any).id,
      settings: clean,
    });

    await prisma.systemLog.create({
      data: {
        action: "platform_settings_updated",
        entity: "PlatformSetting",
        details: { settings: clean },
        userId: (session.user as any).id,
      },
    });

    const settings = await getSettingsMap();
    return NextResponse.json({ settings });
  } catch (error) {
    logger.error("Erreur lors de la mise à jour des réglages", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
