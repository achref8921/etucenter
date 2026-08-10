import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { listTeachersWithBalance } from "@/lib/teacher-finance";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const teachers = await listTeachersWithBalance(centerId);

    return NextResponse.json(teachers);
  } catch (error) {
    logger.error("Erreur lors de la récupération du résumé financier", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
