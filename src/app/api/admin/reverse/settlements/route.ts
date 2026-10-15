import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { listPendingSettlements } from "@/lib/reverse-finance";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const settlements = await listPendingSettlements({ centerId });

    return NextResponse.json({ settlements });
  } catch (error) {
    logger.error("Erreur lors de la récupération des règlements en attente", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
