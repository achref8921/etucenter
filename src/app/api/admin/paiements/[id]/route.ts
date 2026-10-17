import { NextRequest, NextResponse } from "next/server";
import { trackEventSafe } from "@/lib/analytics";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { createStudentTransaction, cancelStudentPaiement } from "@/lib/student-finance";
import {
  centerSharePercent,
  computePaymentSplit,
  creditTeacherForPayment,
  reverseTeacherEarningsForReference,
} from "@/lib/teacher-finance";
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

    if (paiement.collecteParProf) {
      return NextResponse.json(
        {
          error:
            "Ce paiement a été encaissé par le professeur : il ne peut pas être modifié ici. Supprimez-le puis ré-encaissez auprès du professeur.",
        },
        { status: 400 }
      );
    }

    const ancienMontant = Number(paiement.montant);
    const diff = montant - ancienMontant;

    let split: ReturnType<typeof computePaymentSplit> | null = null;
    if (paiement.groupe.profId) {
      const profTaux = await prisma.utilisateur.findUnique({
        where: { id: paiement.groupe.profId },
        select: { tauxBenefice: { select: { tauxPourcentage: true } } },
      });
      split = computePaymentSplit(montant, centerSharePercent(profTaux?.tauxBenefice));
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.paiement.update({
        where: { id },
        data: {
          montant,
          tauxApplique: split?.tauxApplique ?? null,
          partCentre: split?.partCentre ?? null,
        },
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
          centerSharePct: split?.tauxApplique,
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

    void trackEventSafe({
      userId: adminId,
      centerId: centreId,
      event: "PAYMENT_UPDATED",
      feature: "Paiements",
      metadata: { paymentId: id },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/**
 * DELETE — ANNULATION d'un paiement élève.
 *
 * Le motif d'annulation est obligatoire (envoyé dans le corps : `motif` ou
 * `raison`). L'annulation efface définitivement le paiement et toutes ses
 * écritures comptables (crédit élève, part prof, dette centre) afin que tous
 * les soldes et agrégats reviennent à leur état d'avant le paiement, et
 * enregistre l'opération dans le registre `paiements_annules`. L'élève reçoit
 * une notification contenant le motif.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;
    const centreId = (session.user as any).centerId;
    const user = session.user as any;
    const adminId = user.id;

    let motif = "";
    try {
      const body = await request.json();
      motif = String(body?.motif ?? body?.raison ?? "").trim();
    } catch {
      motif = "";
    }

    if (motif.length < 3) {
      return NextResponse.json(
        { error: "Le motif de l'annulation est requis (min 3 caractères)" },
        { status: 400 }
      );
    }

    const adminName = [user.prenom, user.nom].filter(Boolean).join(" ").trim() || user.email || null;

    const result = await cancelStudentPaiement({
      centerId: centreId,
      paiementId: id,
      motif,
      actorId: adminId,
      actorRole: (user.role as string) ?? "admin",
      actorName: adminName,
    });

    await sendPushToUser(result.eleveId, {
      title: "Paiement annulé",
      body: `Votre paiement de ${result.montant} DT pour le groupe "${result.groupeNom}" a été annulé. Motif : ${result.motif}`,
      url: "/eleve/notifications",
    }).catch(() => {});

    void trackEventSafe({
      userId: adminId,
      centerId: centreId,
      event: "PAYMENT_DELETED",
      feature: "Paiements",
      metadata: { paymentId: id, reason: motif },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "PAIEMENT_INTROUVABLE"
        ? 404
        : message === "MOTIF_REQUIS"
          ? 400
          : message === "NON_AUTORISE"
            ? 403
            : 500;
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Paiement non trouvé"
            : status === 400
              ? "Motif d'annulation requis"
              : status === 403
                ? "Action non autorisée"
                : "Erreur interne du serveur",
      },
      { status }
    );
  }
}
