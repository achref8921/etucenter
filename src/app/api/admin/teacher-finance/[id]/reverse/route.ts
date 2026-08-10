import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { reverseTransactionSchema } from "@/lib/validations";
import { reverseTeacherTransaction } from "@/lib/teacher-finance";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = reverseTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const centerId = (session.user as any).centerId;

    const reversal = await reverseTeacherTransaction({
      centerId,
      transactionId: id,
      reason: parsed.data.reason,
      actorId: (session.user as any).id,
    });

    return NextResponse.json(reversal, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const map: Record<string, { status: number; message: string }> = {
      TRANSACTION_INTROUVABLE: { status: 404, message: "Transaction introuvable" },
      ANNULATION_IMPOSSIBLE: { status: 400, message: "Une annulation ne peut pas être annulée" },
      DEJA_ANNULEE: { status: 400, message: "Cette transaction a déjà été annulée" },
    };
    const mapped = map[msg] || { status: 500, message: "Erreur interne du serveur" };
    if (!map[msg]) logger.error("Erreur lors de l'annulation de la transaction", { error });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
