import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;
    const centreId = (session.user as any).centerId;

    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const from = fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : undefined;
    const to = toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : undefined;
    const hasRange = !!(from || to);

    // Filtre de dates pour les colonnes @db.Date (séances) : comparaison exacte
    // via des littéraux date, indépendante du fuseau du serveur.
    const dateSql =
      fromRaw && toRaw
        ? Prisma.sql`AND s.date >= ${fromRaw}::date AND s.date <= ${toRaw}::date`
        : fromRaw
        ? Prisma.sql`AND s.date >= ${fromRaw}::date`
        : toRaw
        ? Prisma.sql`AND s.date <= ${toRaw}::date`
        : Prisma.empty;

    // Filtre de dates pour les colonnes DateTime (datePaiement / date de séance).
    const dateWhere = hasRange
      ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
      : undefined;

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
      where: { groupeId: id, statut: "actif", eleve: { deletedAt: null, ghost: false } },
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

    const safeEleveIds = eleveIds.length > 0 ? eleveIds : ["00000000-0000-0000-0000-000000000000"];

    const [dueResults, paidResults, presenceRows, paiements] = await Promise.all([
      prisma.$queryRaw<{ eleve_id: string; total: string }[]>(
        Prisma.sql`SELECT pr.eleve_id, COALESCE(SUM(
           CASE
             WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
             THEN (i.forfait_montant / i.forfait_seances)
             ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
           END
         ), 0) as total
         FROM presences pr
         JOIN seances s ON pr.seance_id = s.id
         JOIN groupes g ON s.groupe_id = g.id
         LEFT JOIN LATERAL (
           SELECT i2.forfait_montant, i2.forfait_seances
           FROM inscriptions i2
           WHERE i2.eleve_id = pr.eleve_id
             AND i2.groupe_id = g.id
             AND (
               i2.statut = 'actif'
               OR (i2.date_fin IS NOT NULL AND i2.date_debut <= s.date AND i2.date_fin >= s.date)
             )
           ORDER BY
             CASE WHEN i2.date_fin IS NOT NULL AND i2.date_debut <= s.date AND i2.date_fin >= s.date THEN 0 ELSE 1 END,
             CASE WHEN i2.statut = 'actif' THEN 0 ELSE 1 END,
             i2.date_debut DESC NULLS LAST
           LIMIT 1
         ) i ON TRUE
         WHERE pr.statut = 'present' AND s.statut <> 'annulee' AND s.groupe_id = ${id}::uuid
           ${dateSql}
           AND pr.eleve_id = ANY(${safeEleveIds}::uuid[])
         GROUP BY pr.eleve_id`,
      ),
      prisma.paiement.groupBy({
        by: ["eleveId"],
        where: {
          groupeId: id,
          eleveId: { in: eleveIds },
          ...(dateWhere ? { datePaiement: dateWhere } : {}),
        },
        _sum: { montant: true },
      }),
      prisma.$queryRaw<{ eleve_id: string; present: number; absent: number }[]>(
        Prisma.sql`SELECT pr.eleve_id,
             COUNT(*) FILTER (WHERE pr.statut = 'present')::int as present,
             COUNT(*) FILTER (WHERE pr.statut = 'absent')::int as absent
           FROM presences pr
           JOIN seances s ON pr.seance_id = s.id
           WHERE s.groupe_id = ${id}::uuid
             ${dateSql}
             AND pr.eleve_id = ANY(${safeEleveIds}::uuid[])
           GROUP BY pr.eleve_id`,
      ),
      prisma.paiement.findMany({
        where: {
          groupeId: id,
          ...(dateWhere ? { datePaiement: dateWhere } : {}),
        },
        orderBy: { datePaiement: "desc" },
        include: {
          eleve: { select: { id: true, nom: true, prenom: true } },
        },
      }),
    ]);

    const debtIds = paiements
      .filter((p) => p.collecteParProf && p.reverseDebtId)
      .map((p) => p.reverseDebtId as string);
    const reverseDebts = debtIds.length
      ? await prisma.teacherCenterDebt.findMany({
          where: { id: { in: debtIds } },
          select: { id: true, teacher: { select: { id: true, nom: true, prenom: true } } },
        })
      : [];
    const collectorByDebt = new Map(reverseDebts.map((d) => [d.id, d.teacher]));

    const paiementsResult = paiements.map((p) => ({
      id: p.id,
      date: p.datePaiement,
      montant: Number(p.montant),
      methodePaiement: p.methodePaiement,
      reference: p.reference,
      notes: p.notes,
      collecteParProf: p.collecteParProf,
      eleve: { id: p.eleve.id, nom: p.eleve.nom, prenom: p.eleve.prenom },
      collectedBy: p.collecteParProf
        ? collectorByDebt.get(p.reverseDebtId ?? "") ?? groupe.prof ?? null
        : null,
    }));

    const dueMap = new Map(dueResults.map((r) => [r.eleve_id, Number(r.total)]));
    const paidMap = new Map(paidResults.map((r) => [r.eleveId, Number(r._sum.montant ?? 0)]));
    const presencesCountMap = new Map(presenceRows.map((r) => [r.eleve_id, Number(r.present)]));
    const absencesCountMap = new Map(presenceRows.map((r) => [r.eleve_id, Number(r.absent)]));

    const inscriptionsWithStats = inscriptions.map((inscription) => {
      const totalDue = dueMap.get(inscription.eleveId) ?? 0;
      const totalPaid = paidMap.get(inscription.eleveId) ?? 0;
      return {
        id: inscription.id,
        dateInscription: inscription.dateInscription,
        statut: inscription.statut,
        forfaitMontant: inscription.forfaitMontant,
        forfaitSeances: inscription.forfaitSeances,
        forfaitSetAt: inscription.forfaitSetAt,
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
        where: { groupeId: id, ...(dateWhere ? { date: dateWhere } : {}) },
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

    const periodTotalPaid = paiementsResult.reduce((acc, p) => acc + p.montant, 0);

    logger.info("Détails groupe récupérés", {
      adminId: (session.user as any).id,
      groupeId: id,
      hasRange,
    });

    return NextResponse.json({
      groupe,
      inscriptions: inscriptionsWithStats,
      seances: seancesWithStats,
      paiements: paiementsResult,
      financialSummary,
      periodTotalPaid,
      hasRange,
      periode: { from: fromRaw, to: toRaw },
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération des détails groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
