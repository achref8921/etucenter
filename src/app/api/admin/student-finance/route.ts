import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { studentTransactionSchema } from "@/lib/validations";
import {
  createStudentTransaction,
  getStudentBalance,
  listStudentTransactions,
} from "@/lib/student-finance";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const { searchParams } = new URL(request.url);

    const studentId = searchParams.get("studentId") || undefined;
    const type = searchParams.get("type") || undefined;
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const page = Number(searchParams.get("page") ?? "1");

    const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : undefined;
    const to = toRaw ? new Date(`${toRaw}T23:59:59`) : undefined;

    if (studentId) {
      const student = await prisma.utilisateur.findUnique({
        where: { id: studentId, centerId, role: "eleve" },
        select: { id: true },
      });
      if (!student) {
        return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
      }
    }

    const [ledger, balance] = await Promise.all([
      listStudentTransactions({ centerId, eleveId: studentId, from, to, type, page }),
      studentId ? getStudentBalance(centerId, studentId) : Promise.resolve(0),
    ]);

    return NextResponse.json({
      transactions: ledger.items,
      total: ledger.total,
      page: ledger.page,
      pageSize: ledger.pageSize,
      totalPages: ledger.totalPages,
      balance,
      filters: { studentId, type, from: fromRaw ?? null, to: toRaw ?? null },
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération du grand livre élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = studentTransactionSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la transaction élève", {
        errors: parsed.error.flatten(),
      });
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const {
      studentId,
      type,
      amount,
      credit,
      date,
      time,
      paymentMethod,
      reference,
      notes,
      idempotencyKey,
    } = parsed.data;
    const centerId = (session.user as any).centerId;

    const transaction = await createStudentTransaction({
      centerId,
      eleveId: studentId,
      type,
      amount,
      credit,
      date: date ? new Date(`${date}T00:00:00`) : undefined,
      time,
      paymentMethod,
      reference,
      notes,
      idempotencyKey,
      createdBy: (session.user as any).id,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "ELEVE_INTROUVABLE"
        ? "Élève non trouvé"
        : "Erreur interne du serveur";
    logger.error("Erreur lors de la création de la transaction élève", { error });
    return NextResponse.json(
      { error: message },
      { status: message === "Élève non trouvé" ? 404 : 500 }
    );
  }
}
