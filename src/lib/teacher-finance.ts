import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const TEACHER_CREATABLE_TYPES = ["EARNING", "PAYMENT", "ADJUSTMENT"] as const;

export const DEFAULT_CENTER_SHARE = 20;

export function centerSharePercent(
  tauxBenefice?: { tauxPourcentage?: Prisma.Decimal | number | null } | null
): number {
  if (tauxBenefice && tauxBenefice.tauxPourcentage != null) {
    const t = Number(tauxBenefice.tauxPourcentage);
    return Math.min(100, Math.max(0, t));
  }
  return DEFAULT_CENTER_SHARE;
}

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

export async function getTeacherDashboardFinance(
  centerId: string,
  teacherId: string
): Promise<{ impayeNet: number; claimable: number }> {
  const taux = await prisma.tauxBenefice.findUnique({
    where: { profId: teacherId },
  });
  const profShare = 1 - centerSharePercent(taux) / 100;

  const [financeRows, centerPayments] = await Promise.all([
    prisma.$queryRaw<{ impaye_net: number; claimable: number }[]>`
      WITH teacher_due AS (
        SELECT pr.eleve_id, s.groupe_id,
               SUM(COALESCE(s.prix_par_seance, g.prix_par_seance))::numeric AS due
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        WHERE pr.statut = 'present' AND s.statut = 'terminee'
          AND g.prof_id = ${teacherId}::uuid AND g.center_id = ${centerId}::uuid
        GROUP BY pr.eleve_id, s.groupe_id
      ),
      student_paid AS (
        SELECT p.eleve_id, p.groupe_id,
               SUM(p.montant)::numeric AS paid
        FROM paiements p
        JOIN groupes g ON p.groupe_id = g.id
        WHERE g.prof_id = ${teacherId}::uuid AND g.center_id = ${centerId}::uuid
        GROUP BY p.eleve_id, p.groupe_id
      )
      SELECT
        COALESCE(SUM(GREATEST(d.due - COALESCE(sp.paid, 0), 0) * ${profShare}::numeric), 0)::numeric AS impaye_net,
        COALESCE(SUM(LEAST(COALESCE(sp.paid, 0), d.due) * ${profShare}::numeric), 0)::numeric AS claimable
      FROM teacher_due d
      LEFT JOIN student_paid sp ON d.eleve_id = sp.eleve_id AND d.groupe_id = sp.groupe_id
    `,
    prisma.teacherTransaction.aggregate({
      _sum: { amount: true },
      where: {
        centerId,
        teacherId,
        status: "active",
        OR: [
          { type: "PAYMENT" },
          {
            type: "EARNING",
            OR: [
              { reference: null },
              { NOT: { reference: { startsWith: "paiement:" } } },
            ],
          },
        ],
      },
    }),
  ]);

  const grossClaimable = Number(financeRows[0]?.claimable ?? 0);
  const paidByCenter = Number(centerPayments._sum.amount ?? 0);

  return {
    impayeNet: round2(Number(financeRows[0]?.impaye_net ?? 0)),
    claimable: round2(grossClaimable - paidByCenter),
  };
}

export interface CreateTeacherTransactionInput {
  centerId: string;
  teacherId: string;
  type: "EARNING" | "PAYMENT" | "ADJUSTMENT";
  amount: number;
  credit?: boolean;
  description?: string;
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
      description: input.description?.trim() ?? "",
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

export interface CreditTeacherForPaymentInput {
  centerId: string;
  teacherId: string;
  amount: number;
  description?: string;
  date?: Date;
  paymentMethod?: "especes" | "virement" | "cheque" | "autre" | null;
  reference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  db?: Prisma.TransactionClient;
}

export async function creditTeacherForPayment(input: CreditTeacherForPaymentInput) {
  const { centerId, teacherId, amount, db = prisma } = input;

  const teacher = await db.utilisateur.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      role: true,
      centerId: true,
      tauxBenefice: { select: { tauxPourcentage: true } },
    },
  });

  if (!teacher || teacher.role !== "prof" || teacher.centerId !== centerId) {
    throw new Error("PROFESSEUR_INTROUVABLE");
  }

  const centreShare = centerSharePercent(teacher.tauxBenefice);
  const profShare = round2((Math.abs(amount) * (100 - centreShare)) / 100);
  if (profShare <= 0) return null;

  const date = input.date ?? new Date();

  const transaction = await db.teacherTransaction.create({
    data: {
      centerId,
      teacherId,
      type: "EARNING",
      status: "active",
      amount: profShare,
      signedAmount: profShare,
      description: input.description?.trim() ?? "Paiement élève",
      date,
      time: date,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      createdBy: input.createdBy ?? null,
    },
    include: {
      teacher: {
        select: { id: true, nom: true, prenom: true },
      },
    },
  });

  await db.systemLog.create({
    data: {
      action: "finance.teacher.earning.auto",
      entity: "teacher_transaction",
      entityId: transaction.id,
      userId: input.createdBy ?? null,
      details: {
        teacherId,
        paymentRef: input.reference,
        amount: Number(transaction.amount),
        centreShare,
      },
    },
  });

  logger.info("Gain professeur crédité automatiquement (paiement élève)", {
    userId: input.createdBy,
    transactionId: transaction.id,
    teacherId,
    amount: Number(transaction.amount),
    centreShare,
  });

  return transaction;
}

export async function reverseTeacherEarningsForReference(
  input: {
    centerId: string;
    reference: string;
    actorId?: string | null;
    reason?: string | null;
  },
  db: Prisma.TransactionClient
) {
  const existing = await db.teacherTransaction.findMany({
    where: {
      centerId: input.centerId,
      reference: input.reference,
      type: "EARNING",
      status: "active",
    },
  });

  const now = new Date();
  const reversals: any[] = [];

  for (const txn of existing) {
    const reversal = await db.teacherTransaction.create({
      data: {
        centerId: txn.centerId,
        teacherId: txn.teacherId,
        type: "REVERSAL",
        status: "active",
        amount: Math.abs(Number(txn.signedAmount)),
        signedAmount: round2(-Number(txn.signedAmount)),
        description: "Annulation du gain lié au paiement élève",
        date: now,
        time: now,
        reference: txn.reference,
        notes: input.reason?.trim() || "Modification du paiement",
        createdBy: input.actorId ?? null,
        reversalOfId: txn.id,
      },
    });

    await db.teacherTransaction.update({
      where: { id: txn.id },
      data: { status: "reversed", reversedById: input.actorId ?? null, reversedAt: now },
    });

    reversals.push(reversal);
  }

  return reversals;
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
        description:
          original.description.trim()
            ? `Annulation de : ${original.description}`
            : original.receiptNumber
              ? `Annulation du paiement ${original.receiptNumber}`
              : "Transaction annulée",
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

  const claimableResults = await Promise.all(
    teachers.map((t) => getTeacherDashboardFinance(centerId, t.id))
  );
  const claimableMap = new Map<string, number>();
  teachers.forEach((t, i) => {
    claimableMap.set(t.id, claimableResults[i].claimable);
  });

  return teachers.map((t) => ({
    id: t.id,
    nom: t.nom,
    prenom: t.prenom,
    email: t.email,
    telephone: t.telephone,
    actif: t.actif,
    balance: balanceMap.get(t.id) ?? 0,
    claimable: claimableMap.get(t.id) ?? 0,
  }));
}
