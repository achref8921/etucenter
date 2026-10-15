import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { reverseSettleSchema } from "@/lib/validations";
import { settleReverseDebt, getProfReverseSettings } from "@/lib/reverse-finance";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    const body = await request.json();
    const parsed = reverseSettleSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour le règlement de dette", {
        errors: parsed.error.issues,
      });
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { amount, date, notes } = parsed.data;

    const result = await settleReverseDebt({
      centerId,
      profId,
      debtId: id,
      amount,
      date: date ? new Date(date) : new Date(),
      notes,
      createdBy: profId,
    });

    logger.info("Dette réglée via API", {
      userId: profId,
      debtId: id,
      transactionId: result.transaction.id,
      amount,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      [
        "DETTE_INTROUVABLE",
        "DETTE_PAS_DE_CE_PROF",
        "DETTE_DEJA_REGLEE",
        "DETTE_CONCURRENTE",
        "MONTANT_INVALIDE",
        "REGLEMENT_EN_ATTENTE",
      ].includes(message)
    ) {
      const statusMap: Record<string, number> = {
        DETTE_INTROUVABLE: 404,
        DETTE_PAS_DE_CE_PROF: 403,
        DETTE_DEJA_REGLEE: 400,
        DETTE_CONCURRENTE: 409,
        MONTANT_INVALIDE: 400,
        REGLEMENT_EN_ATTENTE: 409,
      };
      return NextResponse.json({ error: message }, { status: statusMap[message] ?? 400 });
    }
    logger.error("Erreur lors du règlement de dette", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}