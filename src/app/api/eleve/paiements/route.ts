import { NextResponse } from "next/server";
import { requireActiveCenter, ELEVE_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ELEVE_ROLES);
    if (error) return error;

    const eleveId = (session.user as any).id;

    const [paiements, inscriptions] = await Promise.all([
      prisma.paiement.findMany({
        where: { eleveId },
        include: {
          groupe: {
            select: { id: true, nom: true },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),
      prisma.inscription.findMany({
        where: { eleveId, statut: "actif" },
        include: {
          groupe: {
            select: { id: true, nom: true, prixParSeance: true },
          },
        },
      }),
    ]);

    const paidByGroupe = new Map<string, number>();
    for (const p of paiements) {
      paidByGroupe.set(p.groupeId, (paidByGroupe.get(p.groupeId) || 0) + Number(p.montant));
    }

    const groupes = inscriptions.map((ins) => {
      const totalPaid = paidByGroupe.get(ins.groupeId) || 0;
      const totalDue = Number(ins.groupe.prixParSeance);
      return {
        groupe: { id: ins.groupe.id, nom: ins.groupe.nom },
        totalPaid,
        unpaid: Math.max(0, totalDue - totalPaid),
      };
    });

    logger.info("Paiements élève récupérés", {
      eleveId,
      count: paiements.length,
    });

    return NextResponse.json({ groupes, paiements });
  } catch (error) {
    logger.error("Erreur lors de la récupération des paiements élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
