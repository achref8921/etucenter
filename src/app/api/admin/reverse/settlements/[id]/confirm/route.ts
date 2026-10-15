import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { confirmReverseSettlement } from "@/lib/reverse-finance";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const actorId = (session.user as any).id;

    const { id } = await params;

    const result = await confirmReverseSettlement({ centerId, settlementId: id, actorId });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (["REGLEMENT_INTROUVABLE", "REGLEMENT_DEJA_TRAITE", "DETTE_CONCURRENTE"].includes(message)) {
      const statusMap: Record<string, number> = {
        REGLEMENT_INTROUVABLE: 404,
        REGLEMENT_DEJA_TRAITE: 400,
        DETTE_CONCURRENTE: 409,
      };
      return NextResponse.json({ error: message }, { status: statusMap[message] ?? 400 });
    }
    logger.error("Erreur lors de la confirmation du règlement", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
