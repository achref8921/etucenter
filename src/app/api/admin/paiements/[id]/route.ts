import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { createStudentTransaction } from "@/lib/student-finance";
import { creditTeacherForPayment, reverseTeacherEarningsForReference } from "@/lib/teacher-finance";
import { sendPushToUser } from "@/lib/push";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { montant, raison } = body;

    if (!montant || typeof montant !== "number" || montant <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }
    if (!raison || typeof raison !== "string" || raison.trim().length < 3) {
      return NextResponse.json({ error: "La raison est requise (min 3 caractères)" }, { status: 400 });
    }

    const centreId = (session.user as any).centerId;
    const adminId = (session.user as any).id;

    const paiement = await prisma.paiement.findUnique({
      where: { id },
      include: {
        eleve: { select: { id: true, nom: true, prenom: true } },
        groupe: { select: { id: true, nom: true, centerId: true, profId: true } },
      },
    });

    if (!paiement || paiement.groupe.centerId !== centreId) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
    }

    const ancienMontant = Number(paiement.montant);
    const diff = montant - ancienMontant;

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.paiement.update({
        where: { id },
        data: { montant },
        include: {
          eleve: { select: { id: true, nom: true, prenom: true } },
          groupe: { select: { id: true, nom: true, profId: true } },
        },
      });

      if (diff !== 0) {
        await createStudentTransaction(
          {
            centerId: centreId,
            eleveId: paiement.eleveId,
            type: "ADJUSTMENT",
            amount: Math.abs(diff),
            credit: diff > 0,
            description: `Modification du paiement pour le groupe "${paiement.groupe.nom}"`,
            reference: `paiement:${id}`,
            notes: raison.trim(),
            idempotencyKey: `paiement-edit:${id}:${Date.now()}`,
            createdBy: adminId,
          },
          tx
        );
      }

      let teacherEarning = null;
      if (updated.groupe.profId) {
        await reverseTeacherEarningsForReference(
          {
            centerId: centreId,
            reference: `paiement:${id}`,
            actorId: adminId,
            reason: `Montant du paiement modifié : ${ancienMontant} DT → ${montant} DT`,
          },
          tx
        );

        teacherEarning = await creditTeacherForPayment({
          centerId: centreId,
          teacherId: updated.groupe.profId,
          amount: montant,
          description: `Part du prof — paiement de ${updated.eleve.prenom} ${updated.eleve.nom} pour le groupe "${updated.groupe.nom}"`,
          paymentMethod: updated.methodePaiement,
          reference: `paiement:${id}`,
          notes: raison.trim(),
          createdBy: adminId,
          db: tx,
        });
      }

      await tx.notification.create({
        data: {
          centerId: centreId,
          destinataireId: paiement.eleveId,
          titre: "Modification de paiement",
          message: `Votre paiement pour le groupe "${paiement.groupe.nom}" a été modifié par l'administration. Montant: ${ancienMontant} DT → ${montant} DT (${diff > 0 ? "+" : ""}${diff} DT). Raison: ${raison.trim()}`,
          type: "modification_paiement",
        },
      });

      return { ...updated, teacherEarning };
    });

    await sendPushToUser(paiement.eleveId, {
      title: "Modification de paiement",
      body: `Votre paiement pour le groupe "${paiement.groupe.nom}" a été modifié par l'administration. Montant: ${ancienMontant} DT → ${montant} DT (${diff > 0 ? "+" : ""}${diff} DT). Raison: ${raison.trim()}`,
      url: "/eleve/notifications",
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
