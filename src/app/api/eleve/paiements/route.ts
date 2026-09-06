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
        select: {
          id: true,
          groupeId: true,
          forfaitMontant: true,
          forfaitSeances: true,
          forfaitSetAt: true,
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

    const groupeIds = inscriptions.map((ins) => ins.groupeId);
    const dueRows = groupeIds.length
      ? await prisma.$queryRawUnsafe<{ groupe_id: string; total: number }[]>(
          `
          SELECT s.groupe_id,
            COALESCE(SUM(
              CASE
                WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0 AND i.forfait_set_at IS NOT NULL AND s.date >= i.forfait_set_at::date
                THEN (i.forfait_montant / i.forfait_seances)
                ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
              END
            ), 0)::float AS total
          FROM presences pr
          JOIN seances s ON pr.seance_id = s.id
          JOIN groupes g ON s.groupe_id = g.id
          LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
          WHERE pr.eleve_id = $1::uuid AND pr.statut = 'present' AND s.statut <> 'annulee'
            AND s.groupe_id = ANY($2::uuid[])
          GROUP BY s.groupe_id
          `,
          eleveId,
          groupeIds
        )
      : [];

    const dueByGroupe = new Map<string, number>();
    for (const r of dueRows) {
      dueByGroupe.set(r.groupe_id, Number(r.total || 0));
    }

    const groupes = inscriptions.map((ins) => {
      const totalPaid = paidByGroupe.get(ins.groupeId) || 0;
      const totalDue = dueByGroupe.get(ins.groupeId) || 0;
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
