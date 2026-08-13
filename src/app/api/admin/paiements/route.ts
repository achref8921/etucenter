import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { paiementSchema } from "@/lib/validations";
import { createStudentTransaction } from "@/lib/student-finance";
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

    const { paiement, studentTransaction } = await prisma.$transaction(async (tx) => {
      const created = await tx.paiement.create({
        data: {
          eleveId,
          groupeId,
          montant,
          methodePaiement,
          reference: reference ?? null,
          notes: notes ?? null,
        },
        include: {
          eleve: {
            select: { id: true, nom: true, prenom: true },
          },
          groupe: {
            select: { id: true, nom: true, profId: true },
          },
        },
      });

      const studentTransaction = await createStudentTransaction(
        {
          centerId,
          eleveId,
          type: "PREPAYMENT",
          amount: Number(montant),
          description: `Paiement reçu pour le groupe "${created.groupe.nom}"`,
          paymentMethod: methodePaiement,
          reference: reference ?? `paiement:${created.id}`,
          notes: notes ?? null,
          idempotencyKey: `paiement:${created.id}`,
          createdBy: adminId,
        },
        tx
      );

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

      return { paiement: created, studentTransaction };
    });

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
      studentTransactionId: studentTransaction.id,
      eleveId,
      groupeId,
      montant: Number(montant),
      balanceCredited: Number(studentTransaction.signedAmount),
    });

    return NextResponse.json(paiement, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création du paiement", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
