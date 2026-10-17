import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { computePaymentSplit, round2 } from "@/lib/teacher-finance";
import { createStudentTransaction } from "@/lib/student-finance";
import { sendPushToUser, sendPushToUsers } from "@/lib/push";

export const REVERSE_COLLECTION_TYPE = "REVERSE_COLLECTION" as const;
export const CENTER_SETTLEMENT_TYPE = "CENTER_SETTLEMENT" as const;

export const DEBIT_TO_CENTER = "DEBIT_TO_CENTER" as const;
export const DEBIT_SETTLED = "DEBIT_SETTLED" as const;

export const DEFAULT_REVERSE_PCT = new Prisma.Decimal(20.0);

export async function getProfReverseSettings(
  centerId: string,
  profId: string
): Promise<{ teacherReverseEnabled: boolean; teacherReversePct: number; hasProfTaux: boolean }> {
  const prof = await prisma.utilisateur.findUnique({
    where: { id: profId },
    select: {
      role: true,
      centerId: true,
      peutEncaisserReverse: true,
      tauxBenefice: { select: { tauxPourcentage: true } },
    },
  });

  // La part centre est TOUJOURS le taux défini pour ce professeur dans les
  // bénéfices. Le réglage global du centre n'est plus utilisé comme repli.
  const profTaux = prof?.tauxBenefice?.tauxPourcentage;
  const hasProfTaux = profTaux != null;
  const effectivePct = hasProfTaux ? Number(profTaux) : Number(DEFAULT_REVERSE_PCT);

  const teacherReverseEnabled =
    !!prof && prof.role === "prof" && prof.centerId === centerId && prof.peutEncaisserReverse === true;

  return { teacherReverseEnabled, teacherReversePct: effectivePct, hasProfTaux };
}

export function computeReverseBreakdown(amount: number, pct: number) {
  const gross = round2(Math.max(0, Math.abs(amount)));
  const collectionPct = Math.min(100, Math.max(0, pct));
  const centerFee = round2((gross * collectionPct) / 100);
  const netAmount = round2(gross - centerFee);
  return { gross, collectionPct, centerFee, netAmount };
}

export function reverseTypeLabel(type: string): string {
  switch (type) {
    case REVERSE_COLLECTION_TYPE:
      return "Encaissement élève";
    case CENTER_SETTLEMENT_TYPE:
      return "Règlement centre";
    default:
      return type;
  }
}

export interface CollectReversePaymentInput {
  centerId: string;
  profId: string;
  studentId: string;
  groupeId: string;
  amount: number;
  date?: Date;
  notes?: string;
  createdBy?: string;
}

export async function collectReversePayment(input: CollectReversePaymentInput) {
  const { centerId, profId, studentId, groupeId, amount, date = new Date(), notes, createdBy } = input;

  const [prof, groupe] = await Promise.all([
    prisma.utilisateur.findUnique({
      where: { id: profId },
      select: {
        id: true,
        role: true,
        centerId: true,
        nom: true,
        prenom: true,
        peutEncaisserReverse: true,
        tauxBenefice: { select: { tauxPourcentage: true } },
      },
    }),
    prisma.groupe.findUnique({
      where: { id: groupeId },
      select: {
        id: true,
        statut: true,
        profId: true,
        centerId: true,
        nom: true,
      },
    }),
  ]);

  if (!prof || prof.role !== "prof" || prof.centerId !== centerId) {
    throw new Error("PROFESSEUR_INTROUVABLE");
  }

  if (prof.peutEncaisserReverse !== true) {
    throw new Error("REVERSE_NON_AUTORISE");
  }

  if (!groupe || groupe.centerId !== centerId) {
    throw new Error("GROUPE_INTROUVABLE");
  }

  if (groupe.profId !== profId) {
    throw new Error("GROUPE_PAS_DE_CE_PROF");
  }

  if (groupe.statut !== "actif") {
    throw new Error("GROUPE_ARCHIVE");
  }

  const student = await prisma.utilisateur.findFirst({
    where: { id: studentId, centerId, role: "eleve", deletedAt: null },
    select: { id: true, nom: true, prenom: true },
  });

  if (!student) {
    throw new Error("ELEVE_INTROUVABLE");
  }

  const inscription = await prisma.inscription.findFirst({
    where: { eleveId: studentId, groupeId: groupe.id, statut: "actif" },
    select: { id: true },
  });

  if (!inscription) {
    throw new Error("ELEVE_PAS_INS_GROUPE");
  }

  const gross = Math.abs(amount);
  if (gross <= 0 || !Number.isFinite(gross)) {
    throw new Error("MONTANT_INVALIDE");
  }

  // La part centre provient TOUJOURS du taux défini pour ce professeur dans
  // les bénéfices. Si aucun taux n'est défini, on retombe sur le taux par
  // défaut du système (20%) et non sur le réglage global du centre.
  const effectivePct =
    prof.tauxBenefice?.tauxPourcentage != null
      ? Number(prof.tauxBenefice.tauxPourcentage)
      : Number(DEFAULT_REVERSE_PCT);

  const { partCentre: centerFee, partProf: netAmount, tauxApplique } = computePaymentSplit(gross, effectivePct);

  if (centerFee <= 0) {
    throw new Error("PART_CENTRE_NULLE");
  }

  const collectionPct = tauxApplique;

  return prisma.$transaction(async (tx) => {
    const debt = await tx.teacherCenterDebt.create({
      data: {
        centerId,
        teacherId: profId,
        studentId,
        seanceId: null,
        groupeId: groupe.id,
        amountDue: new Prisma.Decimal(centerFee),
        amountPaid: new Prisma.Decimal(0),
        balance: new Prisma.Decimal(centerFee),
        status: "OPEN",
        notes: notes ? notes.trim().slice(0, 500) || null : null,
      },
    });

    // Le paiement est documenté exactement comme un paiement reçu au centre :
    // l'élève voit l'encaissement et son solde prépayé est crédité.
    const paiement = await tx.paiement.create({
      data: {
        eleveId: studentId,
        groupeId: groupe.id,
        montant: new Prisma.Decimal(gross),
        datePaiement: date,
        methodePaiement: "especes",
        notes: [notes?.trim().slice(0, 500), "Encaissé par le professeur"]
          .filter(Boolean)
          .join(" · ") || null,
        tauxApplique: new Prisma.Decimal(tauxApplique),
        partCentre: new Prisma.Decimal(centerFee),
        collecteParProf: true,
        reverseDebtId: debt.id,
      },
    });

    // Crédit du solde prépayé de l'élève (consommé ensuite par les séances).
    const studentTransaction = await createStudentTransaction(
      {
        centerId,
        eleveId: studentId,
        type: "PREPAYMENT",
        amount: gross,
        description: `Paiement reçu pour le groupe "${groupe.nom}" (encaissé par le professeur)`,
        paymentMethod: "especes",
        reference: `paiement:${paiement.id}`,
        notes: notes?.trim().slice(0, 500) ?? null,
        idempotencyKey: `paiement:${paiement.id}`,
        createdBy: createdBy ?? null,
        date,
      },
      tx
    );

    // Part du professeur : gain crédité + espèces déjà reçues (double entrée
    // équilibrée afin que le solde du prof ne soit pas gonflé, puisqu'il a
    // déjà encaissé la somme en mains propres).
    await tx.teacherTransaction.create({
      data: {
        centerId,
        teacherId: profId,
        type: "EARNING",
        status: "active",
        amount: new Prisma.Decimal(netAmount),
        signedAmount: new Prisma.Decimal(netAmount),
        description: `Part du prof — encaissement de ${student.prenom} ${student.nom} pour le groupe "${groupe.nom}"`,
        date,
        time: date,
        reference: `paiement:${paiement.id}`,
        notes: notes?.trim().slice(0, 500) ?? null,
        createdBy: createdBy ?? null,
        mode: "REVERSE",
        groupeId: groupe.id,
      },
    });

    await tx.teacherTransaction.create({
      data: {
        centerId,
        teacherId: profId,
        type: "PAYMENT",
        status: "active",
        amount: new Prisma.Decimal(netAmount),
        signedAmount: new Prisma.Decimal(-netAmount),
        description: `Espèces déjà reçues par le professeur (encaissement de ${student.prenom} ${student.nom})`,
        paymentMethod: "especes",
        date,
        time: date,
        reference: `paiement:${paiement.id}`,
        notes: notes?.trim().slice(0, 500) ?? null,
        createdBy: createdBy ?? null,
        mode: "REVERSE",
        groupeId: groupe.id,
      },
    });

    const transaction = await tx.teacherTransaction.create({
      data: {
        centerId,
        teacherId: profId,
        type: REVERSE_COLLECTION_TYPE,
        status: "active",
        amount: new Prisma.Decimal(gross),
        signedAmount: new Prisma.Decimal(-centerFee),
        description: `Encaissement de ${student.prenom} ${student.nom}`,
        date,
        time: date,
        reference: null,
        notes: notes ? notes.trim().slice(0, 500) || null : null,
        createdBy: createdBy ?? null,
        mode: "REVERSE",
        amountReceived: new Prisma.Decimal(gross),
        centerFee: new Prisma.Decimal(centerFee),
        netAmount: new Prisma.Decimal(netAmount),
        collectionPct: new Prisma.Decimal(collectionPct),
        studentId,
        seanceId: null,
        groupeId: groupe.id,
        direction: DEBIT_TO_CENTER,
        linkedDebtId: debt.id,
      },
    });

    await tx.teacherCenterDebt.update({
      where: { id: debt.id },
      data: { reverseTxId: transaction.id },
    });

    await tx.systemLog.create({
      data: {
        action: "finance.reverse.collect",
        entity: "teacher_center_debt",
        entityId: debt.id,
        userId: createdBy ?? null,
        details: {
          transactionId: transaction.id,
          paiementId: paiement.id,
          studentTransactionId: studentTransaction.id,
          studentId,
          groupeId: groupe.id,
          amount: gross,
          centerFee,
          netAmount,
          collectionPct,
        },
      },
    });

    // Même qualité qu'un paiement encaissé au centre : l'élève est notifié.
    await tx.notification.create({
      data: {
        centerId,
        destinataireId: studentId,
        titre: "Paiement enregistré",
        message: `Votre paiement de ${gross} DT pour le groupe "${groupe.nom}" a été enregistré avec succès.`,
        type: "paiement_eleve",
      },
    });

    logger.info("Encaissement inverse créé", {
      userId: createdBy,
      transactionId: transaction.id,
      debtId: debt.id,
      paiementId: paiement.id,
      studentTransactionId: studentTransaction.id,
      profId,
      amount: gross,
      centerFee,
      netAmount,
      tauxApplique,
    });

    return { transaction, debt, paiement, studentTransaction, breakdown: { gross, centerFee, netAmount, collectionPct } };
  }, { timeout: 30_000 });
}

export interface SettleReverseDebtInput {
  centerId: string;
  profId: string;
  debtId: string;
  amount: number;
  date?: Date;
  notes?: string;
  createdBy?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function notifyCenterAdmins(
  adminIds: string[],
  centerId: string,
  titre: string,
  message: string,
  type: string
) {
  if (adminIds.length === 0) return;
  await prisma.notification.createMany({
    data: adminIds.map((destinataireId) => ({
      centerId,
      destinataireId,
      titre,
      message,
      type,
    })),
  });
}

async function getCenterAdminIds(centerId: string): Promise<string[]> {
  const admins = await prisma.utilisateur.findMany({
    where: { centerId, role: { in: ["admin", "super_admin"] }, deletedAt: null },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/**
 * Le professeur déclare un versement ciblé sur une dette précise.
 * Le versement est créé en attente (`pending`) : le solde de la dette n'est PAS
 * réduit tant qu'un administrateur n'a pas confirmé la réception des fonds.
 */
export async function settleReverseDebt(input: SettleReverseDebtInput) {
  const { centerId, profId, debtId, amount, date = new Date(), notes, createdBy } = input;

  if (!UUID_RE.test(debtId)) {
    throw new Error("DETTE_INTROUVABLE");
  }

  const debt = await prisma.teacherCenterDebt.findUnique({
    where: { id: debtId },
    include: { student: { select: { prenom: true, nom: true } } },
  });

  if (!debt || debt.centerId !== centerId) {
    throw new Error("DETTE_INTROUVABLE");
  }

  if (debt.teacherId !== profId) {
    throw new Error("DETTE_PAS_DE_CE_PROF");
  }

  if (debt.status === "PAID") {
    throw new Error("DETTE_DEJA_REGLEE");
  }

  const settleAmount = Math.abs(amount);
  if (settleAmount <= 0 || !Number.isFinite(settleAmount)) {
    throw new Error("MONTANT_INVALIDE");
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const current = await tx.teacherCenterDebt.findUnique({ where: { id: debtId } });

    if (!current || current.centerId !== centerId) {
      throw new Error("DETTE_INTROUVABLE");
    }
    if (current.teacherId !== profId) {
      throw new Error("DETTE_PAS_DE_CE_PROF");
    }
    if (current.status === "PAID") {
      throw new Error("DETTE_DEJA_REGLEE");
    }

    const alreadyPending = await tx.teacherTransaction.findFirst({
      where: {
        centerId,
        teacherId: profId,
        type: CENTER_SETTLEMENT_TYPE,
        status: "pending",
        linkedDebtId: debtId,
      },
      select: { id: true },
    });
    if (alreadyPending) {
      throw new Error("REGLEMENT_EN_ATTENTE");
    }

    const remaining = Number(current.balance);
    const amountToPay = Math.min(round2(settleAmount), remaining);

    if (amountToPay <= 0) {
      throw new Error("MONTANT_INVALIDE");
    }

    const transaction = await tx.teacherTransaction.create({
      data: {
        centerId,
        teacherId: profId,
        type: CENTER_SETTLEMENT_TYPE,
        status: "pending",
        amount: new Prisma.Decimal(amountToPay),
        signedAmount: new Prisma.Decimal(amountToPay),
        description: `Règlement de la part centre (dette ${current.id.slice(0, 8)})`,
        date,
        time: now,
        reference: null,
        notes: notes ? notes.trim().slice(0, 500) || null : null,
        createdBy: createdBy ?? null,
        mode: "REVERSE",
        linkedDebtId: current.id,
        direction: DEBIT_SETTLED,
        studentId: current.studentId,
        seanceId: current.seanceId,
        groupeId: current.groupeId,
      },
    });

    const studentName = debt.student ? `${debt.student.prenom} ${debt.student.nom}` : "un élève";
    const adminIds = await getCenterAdminIds(centerId);
    if (adminIds.length > 0) {
      await tx.notification.createMany({
        data: adminIds.map((destinataireId) => ({
          centerId,
          destinataireId,
          titre: "Règlement en attente de confirmation",
          message: `Un professeur a déclaré un règlement de ${amountToPay.toFixed(2)} TND (${studentName}). Confirmez la réception pour l'ajouter aux bénéfices du centre.`,
          type: "reglement_attente",
        })),
      });
    }

    await tx.systemLog.create({
      data: {
        action: "finance.reverse.settle.request",
        entity: "teacher_center_debt",
        entityId: debtId,
        userId: createdBy ?? null,
        details: { transactionId: transaction.id, amount: amountToPay, previousBalance: remaining },
      },
    });

    return { transaction, debt: current, adminIds, studentName };
  }).then(async (result) => {
    if (result.adminIds.length > 0) {
      await sendPushToUsers(result.adminIds, {
        title: "Règlement à confirmer",
        body: `${round2(Number(result.transaction.amount))} TND · ${result.studentName}`,
        url: "/admin/benefices",
      }).catch(() => {});
    }

    logger.info("Demande de règlement créée (en attente de confirmation)", {
      userId: createdBy,
      transactionId: result.transaction.id,
      debtId,
      amount: Number(result.transaction.amount),
    });

    return { transaction: result.transaction, debt: result.debt };
  });
}

export interface RequestCenterSettlementInput {
  centerId: string;
  profId: string;
  amount: number;
  date?: Date;
  notes?: string;
  createdBy?: string;
}

/**
 * Le professeur déclare un versement global qu'il souhaite remettre au centre.
 * Aucun solde de dette n'est modifié tant que l'administrateur n'a pas confirmé.
 * À la confirmation, le montant est réparti sur les dettes ouvertes (plus anciennes d'abord).
 */
export async function requestCenterSettlement(input: RequestCenterSettlementInput) {
  const { centerId, profId, amount, date = new Date(), notes, createdBy } = input;

  const declared = Math.abs(amount);
  if (declared <= 0 || !Number.isFinite(declared)) {
    throw new Error("MONTANT_INVALIDE");
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const [openAgg, pendingAgg, prof] = await Promise.all([
      tx.teacherCenterDebt.aggregate({
        _sum: { balance: true },
        where: { centerId, teacherId: profId, status: { in: ["OPEN", "PARTIAL"] } },
      }),
      tx.teacherTransaction.aggregate({
        _sum: { amount: true },
        where: { centerId, teacherId: profId, type: CENTER_SETTLEMENT_TYPE, status: "pending" },
      }),
      tx.utilisateur.findUnique({
        where: { id: profId },
        select: { prenom: true, nom: true },
      }),
    ]);

    const totalBalance = round2(Number(openAgg._sum.balance ?? 0));
    const pendingDeclared = round2(Number(pendingAgg._sum.amount ?? 0));
    const available = round2(totalBalance - pendingDeclared);

    if (totalBalance <= 0) {
      throw new Error("AUCUNE_DETTE");
    }
    if (available <= 0) {
      throw new Error("REGLEMENT_EN_ATTENTE");
    }
    if (declared > available) {
      throw new Error("MONTANT_SUPERIEUR_DETTE");
    }

    const transaction = await tx.teacherTransaction.create({
      data: {
        centerId,
        teacherId: profId,
        type: CENTER_SETTLEMENT_TYPE,
        status: "pending",
        amount: new Prisma.Decimal(declared),
        signedAmount: new Prisma.Decimal(declared),
        description: "Déclaration de versement au centre",
        date,
        time: now,
        reference: null,
        notes: notes ? notes.trim().slice(0, 500) || null : null,
        createdBy: createdBy ?? null,
        mode: "REVERSE",
        linkedDebtId: null,
        direction: DEBIT_SETTLED,
      },
    });

    const profName = prof ? `${prof.prenom} ${prof.nom}`.trim() : "Un professeur";
    const adminIds = await getCenterAdminIds(centerId);
    if (adminIds.length > 0) {
      await tx.notification.createMany({
        data: adminIds.map((destinataireId) => ({
          centerId,
          destinataireId,
          titre: "Versement en attente de confirmation",
          message: `${profName} déclare un versement de ${declared.toFixed(2)} TND au centre. Confirmez la réception pour le comptabiliser.`,
          type: "reglement_attente",
        })),
      });
    }

    await tx.systemLog.create({
      data: {
        action: "finance.reverse.settle.request",
        entity: "teacher_transaction",
        entityId: transaction.id,
        userId: createdBy ?? null,
        details: { amount: declared, totalBalance, pendingDeclared },
      },
    });

    return { transaction, adminIds };
  }).then(async (result) => {
    if (result.adminIds.length > 0) {
      await sendPushToUsers(result.adminIds, {
        title: "Versement à confirmer",
        body: `${round2(declared)} TND`,
        url: "/admin/benefices",
      }).catch(() => {});
    }

    logger.info("Déclaration de versement créée (en attente de confirmation)", {
      userId: createdBy,
      transactionId: result.transaction.id,
      profId,
      amount: declared,
    });

    return { transaction: result.transaction };
  });
}

export interface ConfirmSettlementInput {
  centerId: string;
  settlementId: string;
  actorId?: string;
}

/**
 * L'administrateur confirme la réception des fonds. À ce moment seulement le
 * montant est comptabilisé (statut `active`) et les dettes correspondantes sont réduites.
 */
export async function confirmReverseSettlement(input: ConfirmSettlementInput) {
  const { centerId, settlementId, actorId } = input;

  if (!UUID_RE.test(settlementId)) {
    throw new Error("REGLEMENT_INTROUVABLE");
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const txn = await tx.teacherTransaction.findUnique({ where: { id: settlementId } });

    if (!txn || txn.centerId !== centerId || txn.type !== CENTER_SETTLEMENT_TYPE) {
      throw new Error("REGLEMENT_INTROUVABLE");
    }
    if (txn.status !== "pending") {
      throw new Error("REGLEMENT_DEJA_TRAITE");
    }

    let debt: { id: string; status: string } | null = null;

    if (txn.linkedDebtId) {
      const current = await tx.teacherCenterDebt.findUnique({ where: { id: txn.linkedDebtId } });
      if (current && current.status !== "PAID") {
        const remaining = Number(current.balance);
        const amountToPay = Math.min(round2(Number(txn.amount)), remaining);
        const newPaid = round2(Number(current.amountPaid) + amountToPay);
        const newBalance = round2(remaining - amountToPay);
        const newStatus: "OPEN" | "PARTIAL" | "PAID" = newBalance > 0 ? "PARTIAL" : "PAID";

        const guard = await tx.teacherCenterDebt.updateMany({
          where: { id: current.id, status: current.status, balance: new Prisma.Decimal(remaining) },
          data: {
            amountPaid: new Prisma.Decimal(newPaid),
            balance: new Prisma.Decimal(newBalance),
            status: newStatus,
            settlementTxId: txn.id,
            settledAt: newStatus === "PAID" ? now : current.settledAt ?? null,
            updatedAt: now,
          },
        });
        if (guard.count === 0) {
          throw new Error("DETTE_CONCURRENTE");
        }
      }
      debt = await tx.teacherCenterDebt.findUnique({
        where: { id: txn.linkedDebtId },
        select: { id: true, status: true },
      });
    } else {
      // Versement global : répartition FIFO sur les dettes ouvertes / partielles.
      let remainingAlloc = round2(Number(txn.amount));
      const debts = await tx.teacherCenterDebt.findMany({
        where: {
          centerId,
          teacherId: txn.teacherId,
          status: { in: ["OPEN", "PARTIAL"] },
        },
        orderBy: [{ createdAt: "asc" }],
      });

      for (const d of debts) {
        if (remainingAlloc <= 0) break;
        const remaining = Number(d.balance);
        if (remaining <= 0) continue;

        const alloc = Math.min(remainingAlloc, remaining);
        const newPaid = round2(Number(d.amountPaid) + alloc);
        const newBalance = round2(remaining - alloc);
        const newStatus: "OPEN" | "PARTIAL" | "PAID" = newBalance > 0 ? "PARTIAL" : "PAID";

        const guard = await tx.teacherCenterDebt.updateMany({
          where: { id: d.id, status: d.status, balance: new Prisma.Decimal(remaining) },
          data: {
            amountPaid: new Prisma.Decimal(newPaid),
            balance: new Prisma.Decimal(newBalance),
            status: newStatus,
            settlementTxId: txn.id,
            settledAt: newStatus === "PAID" ? now : d.settledAt ?? null,
            updatedAt: now,
          },
        });
        if (guard.count === 0) {
          throw new Error("DETTE_CONCURRENTE");
        }
        remainingAlloc = round2(remainingAlloc - alloc);
      }
    }

    const updated = await tx.teacherTransaction.update({
      where: { id: txn.id },
      data: { status: "active" },
    });

    await tx.notification.create({
      data: {
        centerId,
        destinataireId: txn.teacherId,
        titre: "Règlement confirmé",
        message: `Votre règlement de ${Number(txn.amount).toFixed(2)} TND a été confirmé par le centre.`,
        type: "reglement_confirme",
      },
    });

    await tx.systemLog.create({
      data: {
        action: "finance.reverse.settle.confirm",
        entity: "teacher_transaction",
        entityId: txn.id,
        userId: actorId ?? null,
        details: { debtId: txn.linkedDebtId, amount: Number(txn.amount), debtStatus: debt?.status ?? null },
      },
    });

    return { transaction: updated, debt, teacherId: txn.teacherId };
  });

  await sendPushToUser(result.teacherId, {
    title: "Règlement confirmé",
    body: "Le centre a confirmé la réception de votre règlement.",
    url: "/prof/dettes",
  }).catch(() => {});

  logger.info("Règlement confirmé par l'administrateur", {
    actorId,
    settlementId,
    debtId: result.transaction.linkedDebtId,
    amount: Number(result.transaction.amount),
  });

  return { transaction: result.transaction, debt: result.debt };
}

export interface ListPendingSettlementsFilters {
  centerId: string;
}

export async function listPendingSettlements(filters: ListPendingSettlementsFilters) {
  return prisma.teacherTransaction.findMany({
    where: {
      centerId: filters.centerId,
      type: CENTER_SETTLEMENT_TYPE,
      status: "pending",
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      teacher: { select: { id: true, nom: true, prenom: true } },
      student: { select: { id: true, nom: true, prenom: true } },
      debt: { select: { id: true, status: true, amountDue: true, amountPaid: true, balance: true } },
    },
  });
}

export interface PendingSettlementAmountFilters {
  centerId: string;
  profId: string;
}

export async function getPendingSettlementAmount(filters: PendingSettlementAmountFilters): Promise<number> {
  const agg = await prisma.teacherTransaction.aggregate({
    _sum: { amount: true },
    where: {
      centerId: filters.centerId,
      teacherId: filters.profId,
      type: CENTER_SETTLEMENT_TYPE,
      status: "pending",
    },
  });
  return round2(Number(agg._sum.amount ?? 0));
}

export interface ListProfDebtsFilters {
  centerId: string;
  profId: string;
  status?: "OPEN" | "PARTIAL" | "PAID";
}

export async function listProfDebts(filters: ListProfDebtsFilters) {
  const where: Prisma.TeacherCenterDebtWhereInput = {
    centerId: filters.centerId,
    teacherId: filters.profId,
  };

  if (filters.status) where.status = filters.status;

  const debts = await prisma.teacherCenterDebt.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      student: { select: { id: true, nom: true, prenom: true } },
      groupe: { select: { id: true, nom: true } },
      seance: {
        select: {
          id: true,
          date: true,
          statut: true,
          groupe: { select: { id: true, nom: true } },
        },
      },
      linkedTransactions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          signedAmount: true,
          date: true,
          direction: true,
          centerFee: true,
        },
      },
    },
  });

  return debts;
}

export interface ListProfCollectionsFilters {
  centerId: string;
  profId: string;
}

export async function listProfCollections(filters: ListProfCollectionsFilters) {
  const collections = await prisma.teacherTransaction.findMany({
    where: {
      centerId: filters.centerId,
      teacherId: filters.profId,
      mode: "REVERSE",
      type: REVERSE_COLLECTION_TYPE,
      status: "active",
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      student: { select: { id: true, nom: true, prenom: true } },
      groupe: { select: { id: true, nom: true } },
      seance: {
        select: {
          id: true,
          date: true,
          statut: true,
          groupe: { select: { id: true, nom: true } },
        },
      },
      debt: { select: { id: true, status: true, balance: true, amountDue: true } },
    },
  });

  // On rattache l'identifiant du paiement élève généré par chaque encaissement,
  // afin que le professeur puisse annuler l'encaissement (le paiement est la
  // porte d'entrée de l'annulation).
  const debtIds = collections.map((c) => c.debt?.id).filter((id): id is string => !!id);
  let paiementByDebt = new Map<string, string>();
  if (debtIds.length > 0) {
    const paiements = await prisma.paiement.findMany({
      where: { reverseDebtId: { in: debtIds } },
      select: { id: true, reverseDebtId: true },
    });
    paiementByDebt = new Map(
      paiements.filter((p) => !!p.reverseDebtId).map((p) => [p.reverseDebtId as string, p.id])
    );
  }

  return collections.map((c) => ({
    ...c,
    paiementId: c.debt ? paiementByDebt.get(c.debt.id) ?? null : null,
  }));
}