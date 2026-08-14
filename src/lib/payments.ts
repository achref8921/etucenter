import type { MethodePaiement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createStudentTransaction } from "@/lib/student-finance";
import { creditTeacherForPayment } from "@/lib/teacher-finance";

export interface ProcessStudentPaymentInput {
  centerId: string;
  eleveId: string;
  groupeId: string;
  montant: number;
  methodePaiement: MethodePaiement;
  reference?: string | null;
  notes?: string | null;
  date?: Date;
  createdBy?: string | null;
  idempotencyKey?: string | null;
}

export async function processStudentPayment(input: ProcessStudentPaymentInput) {
  const {
    centerId,
    eleveId,
    groupeId,
    montant,
    methodePaiement,
    reference,
    notes,
    date,
    createdBy,
    idempotencyKey,
  } = input;

  return prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const existing = await tx.studentTransaction.findUnique({
        where: { idempotencyKey },
        include: { eleve: { select: { id: true, nom: true, prenom: true } } },
      });
      if (existing) {
        return { paiement: null, studentTransaction: existing, teacherTransaction: null };
      }
    }

    const created = await tx.paiement.create({
      data: {
        eleveId,
        groupeId,
        montant,
        methodePaiement,
        reference: reference ?? null,
        notes: notes ?? null,
        datePaiement: date ?? undefined,
      },
      include: {
        eleve: { select: { id: true, nom: true, prenom: true } },
        groupe: { select: { id: true, nom: true, profId: true } },
      },
    });

    const paymentRef = reference ?? `paiement:${created.id}`;

    const studentTransaction = await createStudentTransaction(
      {
        centerId,
        eleveId,
        type: "PREPAYMENT",
        amount: Number(montant),
        description: `Paiement reçu pour le groupe "${created.groupe.nom}"`,
        paymentMethod: methodePaiement,
        reference: paymentRef,
        notes: notes ?? null,
        idempotencyKey: `paiement:${created.id}`,
        createdBy: createdBy ?? null,
      },
      tx
    );

    const teacherTransaction = created.groupe.profId
      ? await creditTeacherForPayment({
          centerId,
          teacherId: created.groupe.profId,
          amount: Number(montant),
          description: `Part du prof — paiement de ${created.eleve.prenom} ${created.eleve.nom} pour le groupe "${created.groupe.nom}"`,
          paymentMethod: methodePaiement,
          reference: `paiement:${created.id}`,
          notes: notes ?? null,
          createdBy: createdBy ?? null,
          db: tx,
        })
      : null;

    if (created.groupe.profId) {
      await tx.notification.create({
        data: {
          centerId,
          destinataireId: created.groupe.profId,
          titre: "Nouveau paiement reçu",
          message: `${created.eleve.prenom} ${created.eleve.nom} a payé ${Number(montant)} DT pour le groupe "${created.groupe.nom}".`,
          type: "paiement_recu",
        },
      });
    }

    logger.info("Paiement élève traité (Paiement + crédit + gain prof)", {
      userId: createdBy,
      paiementId: created.id,
      studentTransactionId: studentTransaction.id,
      teacherTransactionId: teacherTransaction?.id ?? null,
      eleveId,
      groupeId,
      montant: Number(montant),
      profCredited: Number(teacherTransaction?.signedAmount ?? 0),
    });

    return { paiement: created, studentTransaction, teacherTransaction };
  });
}
