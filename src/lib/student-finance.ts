import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { round2, reverseTeacherEarningsForReference } from "@/lib/teacher-finance";

export const STUDENT_CREATABLE_TYPES = ["PREPAYMENT", "ADJUSTMENT"] as const;

type DbClient = Prisma.TransactionClient;

const ELEVE_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  codeEleve: true,
} as const;

export function studentSignedAmountFor(
  type: string,
  amount: number,
  credit?: boolean
): number {
  switch (type) {
    case "PREPAYMENT":
      return round2(Math.abs(amount));
    case "COURSE_CONSUMPTION":
      return round2(-Math.abs(amount));
    case "ADJUSTMENT":
      return round2(credit ? Math.abs(amount) : -Math.abs(amount));
    case "REVERSAL":
      return round2(-amount);
    default:
      throw new Error("Type de transaction invalide");
  }
}

export function studentTypeLabel(type: string): string {
  switch (type) {
    case "PREPAYMENT":
      return "Pré-paiement";
    case "COURSE_CONSUMPTION":
      return "Consommation de cours";
    case "ADJUSTMENT":
      return "Ajustement";
    case "REVERSAL":
      return "Annulation";
    default:
      return type;
  }
}

export async function generateStudentReceiptNumber(
  centerId: string,
  date: Date,
  db: DbClient = prisma
): Promise<string> {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await db.studentTransaction.count({
    where: { centerId, type: "PREPAYMENT", date: { gte: start, lt: end } },
  });
  return `RC-${year}-${String(count + 1).padStart(4, "0")}`;
}

export function studentCreditBalanceWhere(
  centerId: string,
  eleveId?: string
): Prisma.StudentTransactionWhereInput {
  return {
    centerId,
    ...(eleveId ? { eleveId } : {}),
    type: { not: "COURSE_CONSUMPTION" },
    NOT: {
      type: "REVERSAL",
      reversalOf: { type: "COURSE_CONSUMPTION" },
    },
  };
}

export async function getStudentBalance(centerId: string, eleveId: string): Promise<number> {
  const agg = await prisma.studentTransaction.aggregate({
    _sum: { signedAmount: true },
    where: studentCreditBalanceWhere(centerId, eleveId),
  });
  return round2(Number(agg._sum.signedAmount ?? 0));
}

function parseTime(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export interface CreateStudentTransactionInput {
  centerId: string;
  eleveId: string;
  type: "PREPAYMENT" | "ADJUSTMENT";
  amount: number;
  credit?: boolean;
  description?: string;
  date?: Date;
  time?: string;
  paymentMethod?: "especes" | "virement" | "cheque" | "autre" | null;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  createdBy?: string | null;
}

export async function createStudentTransaction(
  input: CreateStudentTransactionInput,
  db: DbClient = prisma
) {
  const eleve = await db.utilisateur.findUnique({
    where: { id: input.eleveId },
    select: { id: true, role: true, centerId: true, nom: true, prenom: true },
  });

  if (!eleve || eleve.role !== "eleve" || eleve.centerId !== input.centerId) {
    throw new Error("ELEVE_INTROUVABLE");
  }

  if (input.idempotencyKey) {
    const existing = await db.studentTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { eleve: { select: ELEVE_SELECT } },
    });
    if (existing) return existing;
  }

  const date = input.date ?? new Date();
  const signedAmount = studentSignedAmountFor(input.type, input.amount, input.credit);
  const isPrepayment = input.type === "PREPAYMENT";
  const receiptNumber = isPrepayment
    ? await generateStudentReceiptNumber(input.centerId, date, db)
    : null;

  const time = parseTime(input.time) ?? new Date();
  const description =
    input.description?.trim() ||
    (isPrepayment ? "Paiement anticipé (crédit)" : "Ajustement manuel du solde");

  try {
    const transaction = await db.studentTransaction.create({
      data: {
        centerId: input.centerId,
        eleveId: input.eleveId,
        type: input.type,
        status: "active",
        amount: round2(Math.abs(input.amount)),
        signedAmount,
        description,
        paymentMethod: input.paymentMethod ?? null,
        date,
        time,
        receiptNumber,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        idempotencyKey: input.idempotencyKey?.trim() || null,
        createdBy: input.createdBy ?? null,
      },
      include: { eleve: { select: ELEVE_SELECT } },
    });

    await db.systemLog.create({
      data: {
        action: "finance.student.prepayment",
        entity: "student_transaction",
        entityId: transaction.id,
        userId: input.createdBy ?? null,
        details: {
          eleveId: input.eleveId,
          type: input.type,
          amount: Number(transaction.amount),
          signedAmount,
          receiptNumber,
        },
      },
    });

    logger.info("Transaction financière élève créée", {
      userId: input.createdBy,
      transactionId: transaction.id,
      eleveId: input.eleveId,
      type: input.type,
      amount: Number(transaction.amount),
      signedAmount,
    });

    return transaction;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      input.idempotencyKey
    ) {
      const existing = await db.studentTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { eleve: { select: ELEVE_SELECT } },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export interface ConsumeAttendanceInput {
  centerId: string;
  eleveId: string;
  attendanceId: string;
  actorId?: string | null;
}

async function findConsumption(db: DbClient, eleveId: string, attendanceId: string) {
  return db.studentTransaction.findUnique({
    where: { eleveId_attendanceId: { eleveId, attendanceId } },
  });
}

async function reactivateConsumption(db: DbClient, consumption: any) {
  const reversal = await db.studentTransaction.findUnique({
    where: { reversalOfId: consumption.id },
  });
  if (!reversal || reversal.type !== "REVERSAL") return;

  const now = new Date();
  await db.studentTransaction.update({
    where: { id: reversal.id },
    data: { status: "reversed", reversedById: null, reversedAt: now },
  });

  await db.studentTransaction.update({
    where: { id: consumption.id },
    data: { status: "active", reversedById: null, reversedAt: null },
  });
}

export async function consumeCourseAttendance(
  input: ConsumeAttendanceInput,
  db: DbClient = prisma
) {
  const { centerId, eleveId, attendanceId, actorId } = input;

  const existing = await findConsumption(db, eleveId, attendanceId);
  if (existing) {
    if (existing.status === "active") return existing;
    if (existing.status === "reversed") {
      await reactivateConsumption(db, existing);
      return existing;
    }
    return existing;
  }

  const attendance = await db.presence.findUnique({
    where: { id: attendanceId },
    include: {
      seance: {
        select: {
          id: true,
          statut: true,
          date: true,
          heureDebut: true,
          prixParSeance: true,
          groupe: {
            select: {
              id: true,
              nom: true,
              prixParSeance: true,
              centerId: true,
              matiere: { select: { nom: true } },
            },
          },
        },
      },
    },
  });

  if (!attendance || attendance.eleveId !== eleveId) return null;

  const seance = attendance.seance;
  const groupe = seance.groupe;

  if (groupe.centerId !== centerId) return null;
  if (attendance.statut !== "present") return null;
  if (seance.statut === "annulee") return null;

  const activeInscription = await db.inscription.findFirst({
    where: { eleveId, groupeId: groupe.id, statut: "actif" },
    select: { id: true },
  });
  if (!activeInscription) return null;

  const price = Number(
    seance.prixParSeance != null ? seance.prixParSeance : groupe.prixParSeance
  );
  if (!price || price <= 0) return null;

  const amount = round2(price);
  const date = seance.date;
  const description = `Consommation de cours — ${groupe.matiere?.nom || groupe.nom}`;

  try {
    const transaction = await db.studentTransaction.create({
      data: {
        centerId,
        eleveId,
        type: "COURSE_CONSUMPTION",
        status: "active",
        amount,
        signedAmount: round2(-amount),
        description,
        date,
        time: seance.heureDebut ?? new Date(),
        reference: attendanceId,
        attendanceId,
        notes: `Séance du ${date.toLocaleDateString("fr-FR")}`,
        createdBy: actorId ?? null,
      },
      include: { eleve: { select: ELEVE_SELECT } },
    });

    await db.systemLog.create({
      data: {
        action: "finance.student.consume",
        entity: "student_transaction",
        entityId: transaction.id,
        userId: actorId ?? null,
        details: {
          eleveId,
          attendanceId,
          seanceId: seance.id,
          amount,
          signedAmount: transaction.signedAmount,
        },
      },
    });

    return transaction;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const again = await findConsumption(db, eleveId, attendanceId);
      if (again) return again;
    }
    throw error;
  }
}

export async function reverseCourseAttendance(
  input: ConsumeAttendanceInput,
  db: DbClient = prisma
) {
  const { centerId, eleveId, attendanceId, actorId } = input;

  const consumption = await findConsumption(db, eleveId, attendanceId);
  if (!consumption || consumption.type !== "COURSE_CONSUMPTION") return null;

  const existingReversal = await db.studentTransaction.findUnique({
    where: { reversalOfId: consumption.id },
  });

  if (consumption.status === "reversed") {
    if (existingReversal && existingReversal.status === "active") {
      return consumption;
    }
  }

  const now = new Date();

  if (existingReversal) {
    const reversal = await db.studentTransaction.update({
      where: { id: existingReversal.id },
      data: { status: "active", reversedById: actorId ?? null, reversedAt: null },
      include: { eleve: { select: ELEVE_SELECT } },
    });

    await db.studentTransaction.update({
      where: { id: consumption.id },
      data: { status: "reversed", reversedById: actorId ?? null, reversedAt: now },
    });

    await db.systemLog.create({
      data: {
        action: "finance.student.consume.reverse",
        entity: "student_transaction",
        entityId: consumption.id,
        userId: actorId ?? null,
        details: { eleveId, attendanceId, reversalId: reversal.id },
      },
    });

    return reversal;
  }

  const reversal = await db.studentTransaction.create({
    data: {
      centerId,
      eleveId,
      type: "REVERSAL",
      status: "active",
      amount: Math.abs(Number(consumption.signedAmount)),
      signedAmount: round2(-Number(consumption.signedAmount)),
      description: "Annulation de la consommation de cours",
      date: now,
      time: now,
      reference: consumption.reference ?? null,
      notes: "Présence annulée",
      createdBy: actorId ?? null,
      reversalOfId: consumption.id,
    },
    include: { eleve: { select: ELEVE_SELECT } },
  });

  await db.studentTransaction.update({
    where: { id: consumption.id },
    data: { status: "reversed", reversedById: actorId ?? null, reversedAt: now },
  });

  await db.systemLog.create({
    data: {
      action: "finance.student.consume.reverse",
      entity: "student_transaction",
      entityId: consumption.id,
      userId: actorId ?? null,
      details: { eleveId, attendanceId, reversalId: reversal.id },
    },
  });

  return reversal;
}

export interface ReverseStudentTransactionInput {
  centerId: string;
  transactionId: string;
  reason: string;
  actorId?: string | null;
}

export async function reverseStudentTransaction(input: ReverseStudentTransactionInput) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.studentTransaction.findUnique({
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
    const reversal = await tx.studentTransaction.create({
      data: {
        centerId: original.centerId,
        eleveId: original.eleveId,
        type: "REVERSAL",
        status: "active",
        amount: Math.abs(Number(original.signedAmount)),
        signedAmount: round2(-Number(original.signedAmount)),
        description:
          original.description.trim()
            ? `Annulation de : ${original.description}`
            : "Transaction annulée",
        date: now,
        time: now,
        reference: original.reference ?? null,
        notes: input.reason.trim() || "Transaction annulée",
        createdBy: input.actorId ?? null,
        reversalOfId: original.id,
      },
      include: { eleve: { select: ELEVE_SELECT } },
    });

    await tx.studentTransaction.update({
      where: { id: original.id },
      data: { status: "reversed", reversedById: input.actorId ?? null, reversedAt: now },
    });

    let linkedPaiement = null;
    if (original.type === "PREPAYMENT" && original.reference?.startsWith("paiement:")) {
      const paiementId = original.reference.slice("paiement:".length);
      linkedPaiement = await tx.paiement.findFirst({
        where: { id: paiementId, groupe: { centerId: input.centerId } },
        include: { groupe: { select: { profId: true } } },
      });

      if (linkedPaiement) {
        if (linkedPaiement.groupe.profId) {
          await reverseTeacherEarningsForReference(
            {
              centerId: input.centerId,
              reference: `paiement:${paiementId}`,
              actorId: input.actorId ?? null,
              reason: input.reason,
            },
            tx
          );
        }
        await tx.paiement.delete({ where: { id: paiementId } });
      }
    }

    await tx.systemLog.create({
      data: {
        action: "finance.student.reverse",
        entity: "student_transaction",
        entityId: original.id,
        userId: input.actorId ?? null,
        details: {
          eleveId: original.eleveId,
          transactionId: original.id,
          reversalId: reversal.id,
          reason: input.reason,
          linkedPaiementDeleted: linkedPaiement ? linkedPaiement.id : null,
        },
      },
    });

    return reversal;
  });
}

export interface StudentLedgerFilters {
  centerId: string;
  eleveId?: string;
  from?: Date;
  to?: Date;
  type?: string;
  page?: number;
  pageSize?: number;
}

export async function listStudentTransactions(filters: StudentLedgerFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

  const where: Prisma.StudentTransactionWhereInput = {
    centerId: filters.centerId,
  };

  if (filters.eleveId) where.eleveId = filters.eleveId;
  if (filters.type) where.type = filters.type as any;
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = filters.from;
    if (filters.to) where.date.lte = filters.to;
  }

  const [items, total] = await Promise.all([
    prisma.studentTransaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        eleve: { select: ELEVE_SELECT },
        attendance: {
          include: {
            seance: {
              select: {
                id: true,
                date: true,
                groupe: {
                  select: {
                    id: true,
                    nom: true,
                    matiere: { select: { nom: true } },
                  },
                },
              },
            },
          },
        },
        reversalOf: {
          select: { id: true, type: true, amount: true, receiptNumber: true },
        },
      },
    }),
    prisma.studentTransaction.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listStudentsWithBalance(centerId: string) {
  const students = await prisma.utilisateur.findMany({
    where: { centerId, role: "eleve", deletedAt: null },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
      codeEleve: true,
      classe: true,
      actif: true,
      createdAt: true,
    },
    orderBy: [{ prenom: "asc" }],
  });

  const rows = await prisma.studentTransaction.groupBy({
    by: ["eleveId"],
    where: studentCreditBalanceWhere(centerId),
    _sum: { signedAmount: true },
  });

  const inscriptions = await prisma.inscription.findMany({
    where: { statut: "actif", groupe: { centerId } },
    select: {
      eleveId: true,
      groupe: {
        select: {
          id: true,
          nom: true,
          prixParSeance: true,
          matiere: { select: { nom: true } },
        },
      },
    },
  });

  const groupsByStudent = new Map<string, { id: string; nom: string; prixParSeance: number | null; matiere: string | null }[]>();
  for (const ins of inscriptions) {
    const list = groupsByStudent.get(ins.eleveId) ?? [];
    list.push({
      id: ins.groupe.id,
      nom: ins.groupe.nom,
      prixParSeance: Number(ins.groupe.prixParSeance ?? 0) || null,
      matiere: ins.groupe.matiere?.nom ?? null,
    });
    groupsByStudent.set(ins.eleveId, list);
  }

  const balanceMap = new Map<string, number>();
  for (const row of rows) {
    balanceMap.set(row.eleveId, round2(Number(row._sum.signedAmount ?? 0)));
  }

  return students.map((s) => ({
    id: s.id,
    nom: s.nom,
    prenom: s.prenom,
    email: s.email,
    telephone: s.telephone,
    codeEleve: s.codeEleve,
    classe: s.classe,
    actif: s.actif,
    balance: balanceMap.get(s.id) ?? 0,
    inscriptions: groupsByStudent.get(s.id) ?? [],
  }));
}

export async function getStudentFinanceOverview(centerId: string) {
  const [prepaidAgg, consumedAgg, balances] = await Promise.all([
    prisma.studentTransaction.aggregate({
      _sum: { signedAmount: true },
      where: { centerId, type: "PREPAYMENT", status: "active" },
    }),
    prisma.studentTransaction.aggregate({
      _sum: { signedAmount: true },
      where: { centerId, type: "COURSE_CONSUMPTION", status: "active" },
    }),
    prisma.studentTransaction.groupBy({
      by: ["eleveId"],
      where: studentCreditBalanceWhere(centerId),
      _sum: { signedAmount: true },
    }),
  ]);

  let positiveCount = 0;
  let negativeCount = 0;
  let availableCredits = 0;
  let studentDebt = 0;

  for (const row of balances) {
    const bal = round2(Number(row._sum.signedAmount ?? 0));
    if (bal > 0) {
      positiveCount++;
      availableCredits = round2(availableCredits + bal);
    } else if (bal < 0) {
      negativeCount++;
      studentDebt = round2(studentDebt + Math.abs(bal));
    }
  }

  return {
    totalPrepaid: round2(Number(prepaidAgg._sum.signedAmount ?? 0)),
    totalConsumed: round2(Math.abs(Number(consumedAgg._sum.signedAmount ?? 0))),
    availableCredits,
    studentDebt,
    positiveCount,
    negativeCount,
  };
}
