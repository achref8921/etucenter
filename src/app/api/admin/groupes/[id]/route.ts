import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;

    const centreId = (session.user as any).centerId;

    const groupe = await prisma.groupe.findUnique({
      where: { id },
      include: {
        prof: {
          select: { id: true, nom: true, prenom: true },
        },
        matiere: {
          select: { id: true, nom: true },
        },
      },
    });

    if (!groupe || groupe.centerId !== centreId) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const inscriptions = await prisma.inscription.findMany({
      where: { groupeId: id, statut: "actif", eleve: { deletedAt: null } },
      include: {
        eleve: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
          },
        },
      },
      orderBy: { dateInscription: "desc" },
    });

    const eleveIds = inscriptions.map((i) => i.eleveId);

    const [dueResults, paidResults, presenceCounts, absenceCounts] = await Promise.all([
      prisma.$queryRawUnsafe<{ eleve_id: string; total: string }[]>(
        `SELECT pr.eleve_id, COALESCE(SUM(COALESCE(s.prix_par_seance, g.prix_par_seance)), 0) as total
         FROM presences pr
         JOIN seances s ON pr.seance_id = s.id
         JOIN groupes g ON s.groupe_id = g.id
         WHERE pr.statut = 'present' AND s.statut = 'terminee' AND s.groupe_id = $1::uuid
           AND pr.eleve_id = ANY($2::uuid[])
         GROUP BY pr.eleve_id`,
        id,
        eleveIds.length > 0 ? eleveIds : ["00000000-0000-0000-0000-000000000000"],
      ),
      prisma.paiement.groupBy({
        by: ["eleveId"],
        where: { groupeId: id, eleveId: { in: eleveIds } },
        _sum: { montant: true },
      }),
      prisma.presence.groupBy({
        by: ["eleveId"],
        where: { statut: "present", seance: { groupeId: id }, eleveId: { in: eleveIds } },
        _count: true,
      }),
      prisma.presence.groupBy({
        by: ["eleveId"],
        where: { statut: "absent", seance: { groupeId: id }, eleveId: { in: eleveIds } },
        _count: true,
      }),
    ]);

    const dueMap = new Map(dueResults.map((r) => [r.eleve_id, Number(r.total)]));
    const paidMap = new Map(paidResults.map((r) => [r.eleveId, Number(r._sum.montant ?? 0)]));
    const presencesCountMap = new Map(presenceCounts.map((r) => [r.eleveId, r._count ?? 0]));
    const absencesCountMap = new Map(absenceCounts.map((r) => [r.eleveId, r._count ?? 0]));

    const inscriptionsWithStats = inscriptions.map((inscription) => {
      const totalDue = dueMap.get(inscription.eleveId) ?? 0;
      const totalPaid = paidMap.get(inscription.eleveId) ?? 0;
      return {
        id: inscription.id,
        dateInscription: inscription.dateInscription,
        statut: inscription.statut,
        eleve: inscription.eleve,
        stats: {
          presencesCount: presencesCountMap.get(inscription.eleveId) ?? 0,
          absencesCount: absencesCountMap.get(inscription.eleveId) ?? 0,
          totalDue,
          totalPaid,
          unpaid: totalDue - totalPaid,
        },
      };
    });

    const [seances, totalPresencesPerSeance, presentsPerSeance] = await Promise.all([
      prisma.seance.findMany({
        where: { groupeId: id },
        orderBy: { date: "desc" },
      }),
      prisma.presence.groupBy({
        by: ["seanceId"],
        where: { seance: { groupeId: id } },
        _count: true,
      }),
      prisma.presence.groupBy({
        by: ["seanceId"],
        where: { seance: { groupeId: id }, statut: "present" },
        _count: true,
      }),
    ]);

    const seancePresencesMap = new Map(totalPresencesPerSeance.map((r) => [r.seanceId, r._count ?? 0]));
    const seancePresentsMap = new Map(presentsPerSeance.map((r) => [r.seanceId, r._count ?? 0]));

    const seancesWithStats = seances.map((seance) => {
      const totalEleves = seancePresencesMap.get(seance.id) ?? 0;
      return {
        id: seance.id,
        date: seance.date,
        heureDebut: seance.heureDebut,
        heureFin: seance.heureFin,
        statut: seance.statut,
        notes: seance.notes,
        stats: {
          presentsCount: seancePresentsMap.get(seance.id) ?? 0,
          totalEleves,
        },
      };
    });

    const financialSummary = inscriptionsWithStats.reduce(
      (acc, insc) => ({
        totalDue: acc.totalDue + insc.stats.totalDue,
        totalPaid: acc.totalPaid + insc.stats.totalPaid,
        unpaid: acc.unpaid + insc.stats.unpaid,
      }),
      { totalDue: 0, totalPaid: 0, unpaid: 0 }
    );

    logger.info("Détails groupe récupérés", {
      adminId: (session.user as any).id,
      groupeId: id,
    });

    return NextResponse.json({
      groupe,
      inscriptions: inscriptionsWithStats,
      seances: seancesWithStats,
      financialSummary,
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération des détails groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
