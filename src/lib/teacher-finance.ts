import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const TEACHER_CREATABLE_TYPES = ["EARNING", "PAYMENT", "ADJUSTMENT"] as const;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function signedAmountFor(
  type: string,
  amount: number,
  credit?: boolean
): number {
  switch (type) {
    case "EARNING":
      return round2(Math.abs(amount));
    case "PAYMENT":
      return round2(-Math.abs(amount));
    case "ADJUSTMENT":
      return round2(credit ? Math.abs(amount) : -Math.abs(amount));
    case "REVERSAL":
      return round2(-amount);
    default:
      throw new Error("Type de transaction invalide");
  }
}

export function typeLabel(type: string): string {
  switch (type) {
    case "EARNING":
      return "Gain";
    case "PAYMENT":
      return "Paiement";
    case "ADJUSTMENT":
      return "Ajustement";
    case "REVERSAL":
      return "Annulation";
    default:
      return type;
  }
}

export async function generateReceiptNumber(centerId: string, date: Date): Promise<string> {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.teacherTransaction.count({
    where: { centerId, type: "PAYMENT", date: { gte: start, lt: end } },
  });
  return `RC-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function getTeacherBalance(centerId: string, teacherId: string): Promise<number> {
  const agg = await prisma.teacherTransaction.aggregate({
    _sum: { signedAmount: true },
    where: { centerId, teacherId },
  });
  return round2(Number(agg._sum.signedAmount ?? 0));
}

export interface CreateTeacherTransactionInput {
  centerId: string;
  teacherId: string;
  type: "EARNING" | "PAYMENT" | "ADJUSTMENT";
  amount: number;
  credit?: boolean;
  description: string;
  date?: Date;
  paymentMethod?: "especes" | "virement" | "cheque" | "autre" | null;
  reference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export async function createTeacherTransaction(input: CreateTeacherTransactionInput) {
  const teacher = await prisma.utilisateur.findUnique({
    where: { id: input.teacherId },
    select: { id: true, role: true, centerId: true, nom: true, prenom: true },
  });

  if (!teacher || teacher.role !== "prof" || teacher.centerId !== input.centerId) {
    throw new Error("PROFESSEUR_INTROUVABLE");
  }

  const date = input.date ?? new Date();
  const signedAmount = signedAmountFor(input.type, input.amount, input.credit);
  const isPayment = input.type === "PAYMENT";
  const receiptNumber = isPayment ? await generateReceiptNumber(input.centerId, date) : null;

  const time = new Date();
  time.setHours(date.getHours(), date.getMinutes(), 0, 0);

  const transaction = await prisma.teacherTransaction.create({
    data: {
      centerId: input.centerId,
      teacherId: input.teacherId,
      type: input.type,
      amount: round2(Math.abs(input.amount)),
      signedAmount,
      description: input.description.trim(),
      paymentMethod: isPayment ? (input.paymentMethod ?? "especes") : input.paymentMethod ?? null,
      date,
      time,
      receiptNumber,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      createdBy: input.createdBy ?? null,
    },
    include: {
      teacher: {
        select: { id: true, nom: true, prenom: true, email: true },
      },
    },
  });

  logger.info("Transaction financière professeur créée", {
    userId: input.createdBy,
    transactionId: transaction.id,
    teacherId: input.teacherId,
    type: input.type,
    amount: Number(transaction.amount),
    signedAmount,
  });

  await prisma.systemLog.create({
    data: {
      action: "finance.transaction.create",
      entity: "teacher_transaction",
      entityId: transaction.id,
      userId: input.createdBy ?? null,
      details: {
        teacherId: input.teacherId,
        type: input.type,
        amount: Number(transaction.amount),
        signedAmount,
        description: transaction.description,
      },
    },
  });

  return transaction;
}

export interface ReverseTeacherTransactionInput {
  centerId: string;
  transactionId: string;
  reason: string;
  actorId?: string | null;
}

export async function reverseTeacherTransaction(input: ReverseTeacherTransactionInput) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.teacherTransaction.findUnique({
      where: { id: input.transactionId },
    });

    if (!original || original.centerId !== input.centerId) {
      throw new Error("TRANSACTION_INTROUVABLE");
    }

    if (original.type === "REVERSAL") {
      throw new Error("ANNULATION_IMPOSSIBLE");
    }

    if (original.status === "reversed") {
      throw new Error("DEJA_ANNULEE");
    }

    const now = new Date();
    const reversal = await tx.teacherTransaction.create({
      data: {
        centerId: original.centerId,
        teacherId: original.teacherId,
        type: "REVERSAL",
        amount: Math.abs(Number(original.signedAmount)),
        signedAmount: round2(-Number(original.signedAmount)),
        description: `Annulation de : ${original.description}`,
        date: now,
        time: now,
        reference: original.reference ?? null,
        notes: input.reason.trim() || "Transaction annulée",
        createdBy: input.actorId ?? null,
        reversalOfId: original.id,
      },
      include: {
        teacher: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
      },
    });

    await tx.teacherTransaction.update({
      where: { id: original.id },
      data: { status: "reversed", reversedById: input.actorId ?? null, reversedAt: now },
    });

    await tx.systemLog.create({
      data: {
        action: "finance.transaction.reverse",
        entity: "teacher_transaction",
        entityId: original.id,
        userId: input.actorId ?? null,
        details: {
          reversalId: reversal.id,
          reason: input.reason,
          signedAmount: reversal.signedAmount,
        },
      },
    });

    return reversal;
  });
}

export interface LedgerFilters {
  centerId: string;
  teacherId?: string;
  from?: Date;
  to?: Date;
  type?: string;
  page?: number;
  pageSize?: number;
}

export async function listTeacherTransactions(filters: LedgerFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

  const where: Prisma.TeacherTransactionWhereInput = {
    centerId: filters.centerId,
  };

  if (filters.teacherId) where.teacherId = filters.teacherId;
  if (filters.type) where.type = filters.type as any;
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = filters.from;
    if (filters.to) where.date.lte = filters.to;
  }

  const [items, total] = await Promise.all([
    prisma.teacherTransaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        teacher: {
          select: { id: true, nom: true, prenom: true },
        },
        reversalOf: {
          select: { id: true, type: true, amount: true },
        },
      },
    }),
    prisma.teacherTransaction.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listTeachersWithBalance(centerId: string) {
  const teachers = await prisma.utilisateur.findMany({
    where: { centerId, role: "prof", deletedAt: null },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      actif: true,
      createdAt: true,
    },
    orderBy: [{ prenom: "asc" }],
  });

  const rows = await prisma.teacherTransaction.groupBy({
    by: ["teacherId"],
    where: { centerId },
    _sum: { signedAmount: true },
  });

  const balanceMap = new Map<string, number>();
  for (const row of rows) {
    balanceMap.set(row.teacherId, round2(Number(row._sum.signedAmount ?? 0)));
  }

  return teachers.map((t) => ({
    id: t.id,
    nom: t.nom,
    prenom: t.prenom,
    email: t.email,
    telephone: t.telephone,
    actif: t.actif,
    balance: balanceMap.get(t.id) ?? 0,
  }));
}
