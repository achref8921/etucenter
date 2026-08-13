import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { reverseTransactionSchema } from "@/lib/validations";
import { reverseStudentTransaction } from "@/lib/student-finance";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const parsed = reverseTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Raison invalide" },
        { status: 400 }
      );
    }

    const centerId = (session.user as any).centerId;

    const reversal = await reverseStudentTransaction({
      centerId,
      transactionId: id,
      reason: parsed.data.reason,
      actorId: (session.user as any).id,
    });

    return NextResponse.json(reversal, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "TRANSACTION_INTROUVABLE"
        ? 404
        : message === "ANNULATION_IMPOSSIBLE" || message === "DEJA_ANNULEE"
          ? 400
          : 500;
    return NextResponse.json(
      { error: status === 500 ? "Erreur interne du serveur" : message },
      { status }
    );
  }
}
