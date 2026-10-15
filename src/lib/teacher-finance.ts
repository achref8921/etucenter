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

export interface PaymentSplit {
  gross: number;
  tauxApplique: number;
  partCentre: number;
  partProf: number;
}

/**
 * Répartition figée d'un paiement élève entre la part centre et la part prof.
 * Le taux est celui en vigueur au moment du paiement ; il n'est jamais recalculé
 * ensuite, afin qu'un changement de taux ne modifie pas les calculs passés.
 */
export function computePaymentSplit(amount: number, centerSharePct: number): PaymentSplit {
  const gross = round2(Math.abs(amount));
  const tauxApplique = Math.min(100, Math.max(0, Number(centerSharePct) || 0));
  const partCentre = round2((gross * tauxApplique) / 100);
  const partProf = round2(gross - partCentre);
  return { gross, tauxApplique, partCentre, partProf };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Réapplique rétroactivement un nouveau taux centre à tous les calculs financiers
 * existants d'un professeur : snapshots des paiements (part centre/prof) et gains
 * (EARNING) actifs liés à ces paiements. Les paiements annulés (supprimés) et les
 * écritures reversed sont ignorés.
 */
export async function applyRateToExistingCalculations(input: {
  centerId: string;
  teacherId: string;
  tauxPourcentage: number;
  db?: Prisma.TransactionClient;
}): Promise<{ paiements: number; earnings: number; reversePayments: number; debts: number; reverseCollections: number }> {
  const { centerId, teacherId } = input;
  const db = input.db ?? prisma;
  const centreShare = Math.min(100, Math.max(0, Number(input.tauxPourcentage) || 0));

  const paiements = await db.$executeRawUnsafe(
    `UPDATE paiements pa
       SET taux_applique = $1::numeric,
           part_centre = ROUND(pa.montant * $1::numeric / 100, 2)
     FROM groupes g
     WHERE pa.groupe_id = g.id
       AND g.prof_id = $2::uuid
       AND g.center_id = $3::uuid`,
    centreShare,
    teacherId,
    centerId
  );

  const earnings = await db.$executeRawUnsafe(
    `UPDATE teacher_transactions tt
       SET amount = ROUND(pa.montant - ROUND(pa.montant * $1::numeric / 100, 2), 2),
           signed_amount = ROUND(pa.montant - ROUND(pa.montant * $1::numeric / 100, 2), 2)
     FROM paiements pa
     WHERE tt.reference = 'paiement:' || pa.id::text
       AND tt.type = 'EARNING'
       AND tt.status = 'active'
       AND tt.teacher_id = $2::uuid
       AND tt.center_id = $3::uuid`,
    centreShare,
    teacherId,
    centerId
  );

  // Encaissements effectués par le professeur (collecte inverse) : réapplique le
  // taux aux espèces déjà perçues (PAYMENT) pour rester cohérent avec le gain.
  const reversePayments = await db.$executeRawUnsafe(
    `UPDATE teacher_transactions tt
       SET amount = ROUND(pa.montant - ROUND(pa.montant * $1::numeric / 100, 2), 2),
           signed_amount = -ROUND(pa.montant - ROUND(pa.montant * $1::numeric / 100, 2), 2)
     FROM paiements pa
     JOIN groupes g ON pa.groupe_id = g.id
     WHERE tt.reference = 'paiement:' || pa.id::text
       AND tt.type = 'PAYMENT'
       AND tt.status = 'active'
       AND tt.mode = 'REVERSE'
       AND pa.collecte_par_prof = true
       AND g.prof_id = $2::uuid
       AND g.center_id = $3::uuid`,
    centreShare,
    teacherId,
    centerId
  );

  const reverseCollections = await db.$executeRawUnsafe(
    `WITH rp AS (
       SELECT pa.id AS paiement_id, pa.reverse_debt_id AS debt_id, pa.montant,
              ROUND(pa.montant * $1::numeric / 100, 2) AS part_c,
              ROUND(pa.montant - ROUND(pa.montant * $1::numeric / 100, 2), 2) AS part_p
       FROM paiements pa
       JOIN groupes g ON pa.groupe_id = g.id
       WHERE g.prof_id = $2::uuid
         AND g.center_id = $3::uuid
         AND pa.collecte_par_prof = true
         AND pa.reverse_debt_id IS NOT NULL
     )
     UPDATE teacher_transactions tt
     SET signed_amount = -rp.part_c,
         amount_received = rp.montant,
         center_fee = rp.part_c,
         net_amount = rp.part_p,
         collection_pct = $1::numeric,
         amount = rp.montant
     FROM rp
     WHERE tt.linked_debt_id = rp.debt_id
       AND tt.type = 'REVERSE_COLLECTION'
       AND tt.status = 'active'
       AND tt.teacher_id = $2::uuid
       AND tt.center_id = $3::uuid`,
    centreShare,
    teacherId,
    centerId
  );

  const debts = await db.$executeRawUnsafe(
    `WITH rp AS (
       SELECT pa.reverse_debt_id AS debt_id,
              ROUND(pa.montant * $1::numeric / 100, 2) AS part_c
       FROM paiements pa
       JOIN groupes g ON pa.groupe_id = g.id
       WHERE g.prof_id = $2::uuid
         AND g.center_id = $3::uuid
         AND pa.collecte_par_prof = true
         AND pa.reverse_debt_id IS NOT NULL
     )
     UPDATE teacher_center_debts d
     SET amount_due = rp.part_c,
         balance = GREATEST(rp.part_c - d.amount_paid, 0),
         status = CASE
             WHEN rp.part_c - d.amount_paid <= 0 THEN 'PAID'
             WHEN d.status = 'PAID' THEN 'OPEN'
             ELSE d.status
           END,
         updated_at = now()
     FROM rp
     WHERE d.id = rp.debt_id`,
    centreShare,
    teacherId,
    centerId
  );

  return { paiements, earnings, reversePayments, reverseCollections, debts };
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
    case "REVERSE_COLLECTION":
      return "Encaissement élève";
    case "CENTER_SETTLEMENT":
      return "Règlement centre";
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
    where: { centerId, teacherId, status: { in: ["active", "reversed"] } },
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
  const centreShare = centerSharePercent(taux);
  const profShare = 1 - centreShare / 100;

  const [financeRows, centerPayments] = await Promise.all([
    prisma.$queryRaw<{ impaye_net: number; claimable: number }[]>`
      WITH teacher_due AS (
        SELECT pr.eleve_id, s.groupe_id,
               SUM(
                 CASE
                   WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
                   THEN (i.forfait_montant / i.forfait_seances)
                   ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
                 END
               )::numeric AS due
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
        WHERE pr.statut = 'present' AND s.statut = 'terminee'
          AND g.prof_id = ${teacherId}::uuid AND g.center_id = ${centerId}::uuid
        GROUP BY pr.eleve_id, s.groupe_id
      ),
      payment_roll AS (
        SELECT p.eleve_id, p.groupe_id, p.montant,
               COALESCE(p.part_centre, (p.montant * ${centreShare}::numeric) / 100) AS part_centre,
               SUM(p.montant) OVER (
                 PARTITION BY p.eleve_id, p.groupe_id
                 ORDER BY p.date_paiement, p.created_at, p.id
               ) AS run_paid
        FROM paiements p
        JOIN groupes g ON p.groupe_id = g.id
        WHERE g.prof_id = ${teacherId}::uuid AND g.center_id = ${centerId}::uuid
      ),
      counted AS (
        SELECT pr.montant, pr.part_centre,
               GREATEST(
                 0,
                 LEAST(pr.run_paid, COALESCE(d.due, 0))
                 - LEAST(pr.run_paid - pr.montant, COALESCE(d.due, 0))
               ) AS amt
        FROM payment_roll pr
        LEFT JOIN teacher_due d ON d.eleve_id = pr.eleve_id AND d.groupe_id = pr.groupe_id
      ),
      paid_by_group AS (
        SELECT eleve_id, groupe_id, SUM(montant)::numeric AS paid
        FROM payment_roll
        GROUP BY eleve_id, groupe_id
      ),
      due_paid AS (
        SELECT COALESCE(d.eleve_id, pg.eleve_id) AS eleve_id,
               COALESCE(d.groupe_id, pg.groupe_id) AS groupe_id,
               COALESCE(d.due, 0)::numeric AS due,
               COALESCE(pg.paid, 0)::numeric AS paid
        FROM teacher_due d
        FULL JOIN paid_by_group pg ON pg.eleve_id = d.eleve_id AND pg.groupe_id = d.groupe_id
      )
      SELECT
        COALESCE((SELECT SUM(GREATEST(due - paid, 0)) FROM due_paid), 0) * ${profShare}::numeric AS impaye_net,
        COALESCE((SELECT SUM(amt * (montant - part_centre) / NULLIF(montant, 0)) FROM counted), 0) AS claimable
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

export interface TeacherProfitParams {
  centerId: string;
  teacherId: string;
  from: Date;
  to: Date;
}

export interface TeacherProfit {
  total: number;
  studentShare: number;
  reverseNet: number;
  adjustments: number;
}

const isStudentShareGain = (t: { type: string; reference: string | null; mode?: string | null }) =>
  t.type === "EARNING" &&
  (t.reference?.startsWith("paiement:") ?? false) &&
  t.mode !== "REVERSE";

export function monthRange(month?: string): { from: Date; to: Date } {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const parts = month.split("-").map(Number);
    y = parts[0];
    m = parts[1] - 1;
  }
  return { from: new Date(y, m, 1, 0, 0, 0, 0), to: new Date(y, m + 1, 1, 0, 0, 0, 0) };
}

export async function getTeacherProfit(params: TeacherProfitParams): Promise<TeacherProfit> {
  const txns = await prisma.teacherTransaction.findMany({
    where: { centerId: params.centerId, teacherId: params.teacherId, date: { gte: params.from, lt: params.to } },
    select: {
      type: true,
      signedAmount: true,
      netAmount: true,
      amountReceived: true,
      centerFee: true,
      reference: true,
      mode: true,
      reversalOf: { select: { type: true, reference: true, mode: true } },
    },
  });

  let studentShare = 0;
  let reverseNet = 0;
  let adjustments = 0;

  for (const tx of txns) {
    if (isStudentShareGain(tx)) {
      studentShare += Number(tx.signedAmount);
    } else if (tx.type === "REVERSE_COLLECTION") {
      const net =
        tx.netAmount != null
          ? Number(tx.netAmount)
          : Number(tx.amountReceived ?? 0) - Number(tx.centerFee ?? 0);
      reverseNet += net;
    } else if (tx.type === "ADJUSTMENT") {
      adjustments += Number(tx.signedAmount);
    } else if (tx.type === "REVERSAL" && tx.reversalOf) {
      if (isStudentShareGain(tx.reversalOf)) {
        studentShare += Number(tx.signedAmount);
      } else if (tx.reversalOf.type === "ADJUSTMENT") {
        adjustments += Number(tx.signedAmount);
      }
    }
  }

  studentShare = round2(studentShare);
  reverseNet = round2(reverseNet);
  adjustments = round2(adjustments);

  return {
    total: round2(studentShare + reverseNet + adjustments),
    studentShare,
    reverseNet,
    adjustments,
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
  /** Taux centre déjà figé au moment du paiement (évite une lecture supplémentaire). */
  centerSharePct?: number;
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

  const centreShare =
    input.centerSharePct != null ? input.centerSharePct : centerSharePercent(teacher.tauxBenefice);
  const { partProf: profShare } = computePaymentSplit(amount, centreShare);
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
    where: { centerId, status: { in: ["active", "reversed"] } },
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
