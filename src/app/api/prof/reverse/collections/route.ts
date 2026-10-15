import { NextRequest, NextResponse } from "next/server";
import { trackEventSafe } from "@/lib/analytics";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendPushToUser } from "@/lib/push";
import { reverseCollectSchema } from "@/lib/validations";
import {
  collectReversePayment,
  listProfCollections,
  getProfReverseSettings,
} from "@/lib/reverse-finance";
import { clientNowFromOffset } from "@/lib/utils";
import { finalizePassedSeances } from "@/lib/seance-finalizer";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const profId = (session.user as any).id;

    const { searchParams } = new URL(request.url);
    const timezoneOffset = Number(searchParams.get("timezoneOffset") ?? "0");
    await finalizePassedSeances(centerId, clientNowFromOffset(timezoneOffset));

    const [collections, settings] = await Promise.all([
      listProfCollections({ centerId, profId }),
      getProfReverseSettings(centerId, profId),
    ]);

    return NextResponse.json({ collections, settings });
  } catch (error) {
    logger.error("Erreur lors de la récupération des encaissements", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const profId = (session.user as any).id;

    const settings = await getProfReverseSettings(centerId, profId);
    if (!settings.teacherReverseEnabled) {
      return NextResponse.json(
        { error: "La collecte inverse n'est pas activée pour ce professeur" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = reverseCollectSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour l'encaissement inverse", {
        errors: parsed.error.issues,
      });
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { studentId, groupeId, amount, date, notes } = parsed.data;

    const result = await collectReversePayment({
      centerId,
      profId,
      studentId,
      groupeId,
      amount,
      date: date ? new Date(date) : new Date(),
      notes,
      createdBy: profId,
    });

    logger.info("Encaissement inverse créé via API", {
      userId: profId,
      transactionId: result.transaction.id,
      debtId: result.debt.id,
    });

    await sendPushToUser(studentId, {
      title: "Paiement enregistré",
      body: `Votre paiement de ${Number(result.paiement.montant)} DT pour le groupe a été enregistré avec succès.`,
      url: "/eleve/notifications",
    }).catch(() => {});

    void trackEventSafe({
      userId: profId,
      centerId,
      event: "PAYMENT_CREATED",
      feature: "Paiements",
      metadata: {
        paymentId: result.paiement.id,
        studentId,
        collecteParProf: true,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      [
        "PROFESSEUR_INTROUVABLE",
        "MODE_REVERSE_DESACTIVE",
        "REVERSE_NON_AUTORISE",
        "GROUPE_INTROUVABLE",
        "GROUPE_PAS_DE_CE_PROF",
        "GROUPE_ARCHIVE",
        "ELEVE_INTROUVABLE",
        "ELEVE_PAS_INS_GROUPE",
        "MONTANT_INVALIDE",
        "PART_CENTRE_NULLE",
      ].includes(message)
    ) {
      const statusMap: Record<string, number> = {
        MODE_REVERSE_DESACTIVE: 403,
        REVERSE_NON_AUTORISE: 403,
        GROUPE_INTROUVABLE: 404,
        ELEVE_INTROUVABLE: 404,
        ELEVE_PAS_INS_GROUPE: 400,
        PART_CENTRE_NULLE: 400,
        MONTANT_INVALIDE: 400,
        GROUPE_PAS_DE_CE_PROF: 403,
        GROUPE_ARCHIVE: 400,
      };
      return NextResponse.json({ error: message }, { status: statusMap[message] ?? 400 });
    }
    logger.error("Erreur lors de la collecte inverse", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}