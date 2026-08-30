import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { teacherTransactionSchema } from "@/lib/validations";
import {
  createTeacherTransaction,
  getTeacherDashboardFinance,
  listTeacherTransactions,
} from "@/lib/teacher-finance";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const { searchParams } = new URL(request.url);

    const teacherId = searchParams.get("teacherId") || undefined;
    const type = searchParams.get("type") || undefined;
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const page = Number(searchParams.get("page") ?? "1");

    const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : undefined;
    const to = toRaw ? new Date(`${toRaw}T23:59:59`) : undefined;

    if (teacherId) {
      const teacher = await prisma.utilisateur.findUnique({
        where: { id: teacherId, centerId, role: "prof" },
        select: { id: true },
      });
      if (!teacher) {
        return NextResponse.json({ error: "Professeur non trouvé" }, { status: 404 });
      }
    }

    const [ledger, finance] = await Promise.all([
      listTeacherTransactions({ centerId, teacherId, from, to, type, page }),
      teacherId
        ? getTeacherDashboardFinance(centerId, teacherId)
        : Promise.resolve({ claimable: 0, impayeNet: 0 }),
    ]);

    return NextResponse.json({
      transactions: ledger.items,
      total: ledger.total,
      page: ledger.page,
      pageSize: ledger.pageSize,
      totalPages: ledger.totalPages,
      claimable: finance.claimable,
      impayeNet: finance.impayeNet,
      filters: { teacherId, type, from: fromRaw ?? null, to: toRaw ?? null },
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération du grand livre", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = teacherTransactionSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la transaction professeur", {
        errors: parsed.error.flatten(),
      });
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { teacherId, type, amount, credit, date, description, paymentMethod, reference, notes } =
      parsed.data;
    const centerId = (session.user as any).centerId;

    const transaction = await createTeacherTransaction({
      centerId,
      teacherId,
      type,
      amount,
      credit,
      description,
      date: date ? new Date(`${date}T00:00:00`) : undefined,
      paymentMethod,
      reference,
      notes,
      createdBy: (session.user as any).id,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "PROFESSEUR_INTROUVABLE"
        ? "Professeur non trouvé"
        : "Erreur interne du serveur";
    logger.error("Erreur lors de la création de la transaction professeur", { error });
    return NextResponse.json({ error: message }, { status: message === "Professeur non trouvé" ? 404 : 500 });
  }
}
