import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { reverseSettleSchema } from "@/lib/validations";
import { requestCenterSettlement, getProfReverseSettings } from "@/lib/reverse-finance";

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
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

    const body = await request.json();
    const parsed = reverseSettleSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la déclaration de versement", {
        errors: parsed.error.issues,
      });
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { amount, date, notes } = parsed.data;

    const result = await requestCenterSettlement({
      centerId,
      profId,
      amount,
      date: date ? new Date(date) : new Date(),
      notes,
      createdBy: profId,
    });

    logger.info("Déclaration de versement via API", {
      userId: profId,
      transactionId: result.transaction.id,
      amount,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      ["MONTANT_INVALIDE", "AUCUNE_DETTE", "REGLEMENT_EN_ATTENTE", "MONTANT_SUPERIEUR_DETTE"].includes(
        message
      )
    ) {
      const statusMap: Record<string, number> = {
        MONTANT_INVALIDE: 400,
        AUCUNE_DETTE: 400,
        REGLEMENT_EN_ATTENTE: 409,
        MONTANT_SUPERIEUR_DETTE: 400,
      };
      return NextResponse.json({ error: message }, { status: statusMap[message] ?? 400 });
    }
    logger.error("Erreur lors de la déclaration de versement", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
