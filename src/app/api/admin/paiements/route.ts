import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { paiementSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdminRole((session.user as any).role as string)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const centerId = (session.user as any).centerId;

    const paiements = await prisma.paiement.findMany({
      where: { groupe: { centerId } },
      orderBy: { datePaiement: "desc" },
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
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdminRole((session.user as any).role as string)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

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

    const paiement = await prisma.paiement.create({
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

    if (paiement.groupe.profId) {
      await prisma.notification.create({
        data: {
          centerId: (session.user as any).centerId,
          destinataireId: paiement.groupe.profId,
          titre: "Nouveau paiement reçu",
          message: `${paiement.eleve.prenom} ${paiement.eleve.nom} a payé ${Number(montant)} DT pour le groupe "${paiement.groupe.nom}".`,
          type: "paiement_recu",
        },
      });
    }

    logger.info("Paiement créé", {
      adminId: (session.user as any).id,
      paiementId: paiement.id,
      eleveId,
      groupeId,
      montant: Number(montant),
    });

    return NextResponse.json(paiement, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création du paiement", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
