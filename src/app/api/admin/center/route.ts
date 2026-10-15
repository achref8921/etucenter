import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sanitizeImageValue } from "@/lib/utils";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;
    const centerId = (session.user as any).centerId;
    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center) {
      return NextResponse.json({ error: "Center not found" }, { status: 404 });
    }
    return NextResponse.json(center);
  } catch (error) {
    logger.error("Error fetching center", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;
    const centerId = (session.user as any).centerId;

    const body = await request.json();
    const { name, logo, phone, address, teacherReverseEnabled, teacherReversePct } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined && name.trim() !== "") data.name = name.trim();
    if (logo !== undefined) data.logo = sanitizeImageValue(logo);
    if (phone !== undefined) data.phone = phone || null;
    if (address !== undefined) data.address = address || null;

    if (teacherReverseEnabled !== undefined) {
      data.teacherReverseEnabled = Boolean(teacherReverseEnabled);
    }
    if (teacherReversePct !== undefined) {
      const pct = Number(teacherReversePct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return NextResponse.json(
          { error: "Le pourcentage doit être compris entre 0 et 100" },
          { status: 400 }
        );
      }
      data.teacherReversePct = pct;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 });
    }

    const center = await prisma.center.update({
      where: { id: centerId },
      data,
    });

    logger.info("Center updated", { userId: (session.user as any).id, changes: Object.keys(data) });

    await prisma.systemLog.create({
      data: {
        action: "center_updated",
        entity: "center",
        entityId: centerId,
        details: { changes: Object.keys(data), name: center.name },
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json(center);
  } catch (error) {
    logger.error("Error updating center", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
