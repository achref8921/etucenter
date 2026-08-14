import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { paiementSchema } from "@/lib/validations";
import { processStudentPayment } from "@/lib/payments";
import { sendPushToUser } from "@/lib/push";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const paiements = await prisma.paiement.findMany({
      where: { groupe: { centerId } },
      orderBy: { datePaiement: "desc" },
      take: 500,
      include: {
        eleve: {
          select: { id: true, nom: true, prenom: true },
        },
        groupe: {
          select: { id: true, nom: true },
        },
      },
    });

    logger.info("Liste des paiements récupérée", { adminId: (session.user as any).id, count: paiements.length });

    return NextResponse.json(paiements);
  } catch (error) {
    logger.error("Erreur lors de la récupération des paiements", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const parsed = paiementSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la création de paiement", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { eleveId, groupeId, montant, methodePaiement, reference, notes } = parsed.data;
    const centerId = (session.user as any).centerId;

    const [eleve, groupe] = await Promise.all([
      prisma.utilisateur.findUnique({ where: { id: eleveId, centerId } }),
      prisma.groupe.findUnique({ where: { id: groupeId, centerId } }),
    ]);

    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }
    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const adminId = (session.user as any).id;

    const { paiement, teacherTransaction } = await processStudentPayment({
      centerId,
      eleveId,
      groupeId,
      montant,
      methodePaiement,
      reference,
      notes,
      createdBy: adminId,
    });

    if (!paiement) {
      logger.error("Paiement non créé pour un appel POST paiements", { adminId });
      return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
    }

    if (paiement.groupe.profId) {
      await sendPushToUser(paiement.groupe.profId, {
        title: "Nouveau paiement reçu",
        body: `${paiement.eleve.prenom} ${paiement.eleve.nom} a payé ${Number(montant)} DT pour le groupe "${paiement.groupe.nom}".`,
        url: "/prof/notifications",
      }).catch(() => {});
    }

    await prisma.notification.create({
      data: {
        centerId,
        destinataireId: paiement.eleveId,
        titre: "Paiement enregistré",
        message: `Votre paiement de ${Number(montant)} DT pour le groupe "${paiement.groupe.nom}" a été enregistré avec succès.`,
        type: "paiement_eleve",
      },
    });
    await sendPushToUser(paiement.eleveId, {
      title: "Paiement enregistré",
      body: `Votre paiement de ${Number(montant)} DT pour le groupe "${paiement.groupe.nom}" a été enregistré avec succès.`,
      url: "/eleve/notifications",
    }).catch(() => {});

    logger.info("Paiement créé", {
      adminId,
      paiementId: paiement.id,
      teacherTransactionId: teacherTransaction?.id ?? null,
      eleveId,
      groupeId,
      montant: Number(montant),
      profCredited: Number(teacherTransaction?.signedAmount ?? 0),
    });

    return NextResponse.json(
      { paiement, teacherTransaction },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Erreur lors de la création du paiement", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
