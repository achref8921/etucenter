import { NextRequest, NextResponse } from "next/server";
import { trackEventSafe } from "@/lib/analytics";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { sendPushToUser } from "@/lib/push";
import { cancelStudentPaiement } from "@/lib/student-finance";
import { getProfReverseSettings } from "@/lib/reverse-finance";

/**
 * DELETE — Un professeur annule un encaissement qu'IL a réalisé.
 *
 * Le motif est obligatoire (`motif` dans le corps). L'annulation est verrouillée
 * sur les paiements encaissés par ce professeur pour ses propres groupes
 * (`collecteParProf`), afin qu'il ne puisse jamais toucher aux paiements du
 * centre ou d'un autre professeur. Les écritures comptables (crédit élève, part
 * prof, dette centre) sont effacées et l'élève est notifié avec le motif.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const user = session.user as any;
    const profId = user.id;

    const settings = await getProfReverseSettings(centerId, profId);
    if (!settings.teacherReverseEnabled) {
      return NextResponse.json(
        { error: "La collecte inverse n'est pas activée pour ce professeur" },
        { status: 403 }
      );
    }

    const { id } = await params;

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

    const profName = [user.prenom, user.nom].filter(Boolean).join(" ").trim() || user.email || null;

    const result = await cancelStudentPaiement({
      centerId,
      paiementId: id,
      motif,
      actorId: profId,
      actorRole: "prof",
      actorName: profName,
      restrictToTeacherId: profId,
    });

    await sendPushToUser(result.eleveId, {
      title: "Paiement annulé",
      body: `Votre paiement de ${result.montant} DT pour le groupe "${result.groupeNom}" a été annulé. Motif : ${result.motif}`,
      url: "/eleve/notifications",
    }).catch(() => {});

    void trackEventSafe({
      userId: profId,
      centerId,
      event: "PAYMENT_DELETED",
      feature: "Paiements",
      metadata: { paymentId: id, reason: motif, collecteParProf: true },
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
    if (status === 500) {
      logger.error("Erreur lors de l'annulation d'un encaissement par le professeur", { error });
    }
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Paiement introuvable"
            : status === 400
              ? "Motif d'annulation requis"
              : status === 403
                ? "Vous ne pouvez annuler que vos propres encaissements"
                : "Erreur interne du serveur",
      },
      { status }
    );
  }
}
