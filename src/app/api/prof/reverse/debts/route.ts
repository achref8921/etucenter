import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { listProfDebts, getProfReverseSettings, getPendingSettlementAmount } from "@/lib/reverse-finance";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const profId = (session.user as any).id;

    const settings = await getProfReverseSettings(centerId, profId);
    if (!settings.teacherReverseEnabled) {
      return NextResponse.json(
        { error: "La collecte inverse n'est pas activée pour ce professeur" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as "OPEN" | "PARTIAL" | "PAID") ?? undefined;

    const debts = await listProfDebts({ centerId, profId, status });
    const pendingDeclared = await getPendingSettlementAmount({ centerId, profId });

    return NextResponse.json({ debts, pendingDeclared });
  } catch (error) {
    logger.error("Erreur lors de la récupération des dettes", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}