import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export async function calculateTotalDue(eleveId: string, groupeId: string): Promise<number> {
  const result = await prisma.$queryRaw<{ total: string | null }[]>(
    Prisma.sql`SELECT COALESCE(
       SUM(COALESCE(s.prix_par_seance, g.prix_par_seance)),
       0
     ) as total
     FROM presences pr
     JOIN seances s ON pr.seance_id = s.id
     JOIN groupes g ON s.groupe_id = g.id
     WHERE pr.eleve_id = ${eleveId}::uuid
       AND pr.statut = 'present'
       AND s.groupe_id = ${groupeId}::uuid
       AND s.statut = 'terminee'`,
  );

  return Number(result[0]?.total ?? 0);
}

export async function calculateTotalPaid(eleveId: string, groupeId: string): Promise<number> {
  const result = await prisma.paiement.aggregate({
    where: { eleveId, groupeId },
    _sum: { montant: true },
  });

  return Number(result._sum.montant || 0);
}

export async function calculateUnpaid(eleveId: string, groupeId: string): Promise<number> {
  const totalDue = await calculateTotalDue(eleveId, groupeId);
  const totalPaid = await calculateTotalPaid(eleveId, groupeId);
  return Math.max(0, totalDue - totalPaid);
}

export async function calculateStudentStats(eleveId: string) {
  const inscriptions = await prisma.inscription.findMany({
    where: { eleveId, statut: "actif" },
    select: {
      groupeId: true,
      groupe: { select: { nom: true, prixParSeance: true } },
    },
  });

  if (inscriptions.length === 0) return [];

  const groupeIds = inscriptions.map((i) => i.groupeId);

  const [dueResults, paidResults, presencesCounts, absencesCounts] = await Promise.all([
    prisma.$queryRaw<{ groupe_id: string; total: string }[]>(
      Prisma.sql`SELECT s.groupe_id, COALESCE(
         SUM(COALESCE(s.prix_par_seance, g.prix_par_seance)),
         0
       ) as total
       FROM presences pr
       JOIN seances s ON pr.seance_id = s.id
       JOIN groupes g ON s.groupe_id = g.id
       WHERE pr.eleve_id = ${eleveId}::uuid
         AND pr.statut = 'present'
         AND s.statut = 'terminee'
         AND s.groupe_id = ANY(${groupeIds}::uuid[])
       GROUP BY s.groupe_id`,
    ),
    prisma.paiement.groupBy({
      by: ["groupeId"],
      where: { eleveId, groupeId: { in: groupeIds } },
      _sum: { montant: true },
    }),
    prisma.presence.groupBy({
      by: ["seanceId"],
      where: { eleveId, statut: "present", seance: { groupeId: { in: groupeIds } } },
      _count: true,
    }),
    prisma.presence.groupBy({
      by: ["seanceId"],
      where: { eleveId, statut: "absent", seance: { groupeId: { in: groupeIds } } },
      _count: true,
    }),
  ]);

  const dueMap = new Map(dueResults.map((r) => [r.groupe_id, Number(r.total)]));
  const paidMap = new Map(paidResults.map((r) => [r.groupeId, Number(r._sum.montant ?? 0)]));

  const presencesMap = new Map<string, number>();
  const absencesMap = new Map<string, number>();

  const seanceIds = [
    ...presencesCounts.map((r) => r.seanceId),
    ...absencesCounts.map((r) => r.seanceId),
  ];
  if (seanceIds.length > 0) {
    const seanceGroupeMap = await prisma.seance.findMany({
      where: { id: { in: seanceIds } },
      select: { id: true, groupeId: true },
    });
    const seanceToGroupe = new Map(seanceGroupeMap.map((s) => [s.id, s.groupeId]));

    for (const r of presencesCounts) {
      const gid = seanceToGroupe.get(r.seanceId);
      if (gid) presencesMap.set(gid, (presencesMap.get(gid) ?? 0) + (r._count ?? 0));
    }
    for (const r of absencesCounts) {
      const gid = seanceToGroupe.get(r.seanceId);
      if (gid) absencesMap.set(gid, (absencesMap.get(gid) ?? 0) + (r._count ?? 0));
    }
  }

  return inscriptions.map((ins) => {
    const totalDue = dueMap.get(ins.groupeId) ?? 0;
    const totalPaid = paidMap.get(ins.groupeId) ?? 0;
    return {
      groupeId: ins.groupeId,
      groupeNom: ins.groupe.nom,
      prixParSeance: Number(ins.groupe.prixParSeance),
      presencesCount: presencesMap.get(ins.groupeId) ?? 0,
      absencesCount: absencesMap.get(ins.groupeId) ?? 0,
      totalDue,
      totalPaid,
      unpaid: totalDue - totalPaid,
    };
  });
}

export async function getAdminStats(centerId: string) {
  const [totalStudents, totalTeachers, totalSeances, totalRevenue, totalUnpaid] =
    await Promise.all([
      prisma.utilisateur.count({ where: { role: "eleve", centerId, deletedAt: null } }),
      prisma.utilisateur.count({ where: { role: "prof", centerId, deletedAt: null } }),
      prisma.seance.count({ where: { statut: "terminee", groupe: { centerId } } }),
      prisma.paiement.aggregate({ _sum: { montant: true }, where: { groupe: { centerId } } }),
      prisma.$queryRaw(
        Prisma.sql`SELECT COALESCE(SUM(remaining), 0) as total FROM (
          SELECT 
            due.eleve_id,
            due.groupe_id,
            CASE 
              WHEN COALESCE(paid.paid_total, 0) < due.due_total 
              THEN due.due_total - COALESCE(paid.paid_total, 0) 
              ELSE 0 
            END as remaining
          FROM (
            SELECT pr.eleve_id, s.groupe_id, COALESCE(s.prix_par_seance, g.prix_par_seance) * COUNT(*) as due_total
            FROM presences pr
            JOIN seances s ON pr.seance_id = s.id
            JOIN groupes g ON s.groupe_id = g.id
            WHERE pr.statut = 'present' AND s.statut = 'terminee' AND g.center_id = ${centerId}::uuid
            GROUP BY pr.eleve_id, s.groupe_id, s.prix_par_seance, g.prix_par_seance
          ) due
          LEFT JOIN (
            SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) as paid_total
            FROM paiements pai
            JOIN groupes g2 ON pai.groupe_id = g2.id
            WHERE g2.center_id = ${centerId}::uuid
            GROUP BY pai.eleve_id, pai.groupe_id
          ) paid ON due.eleve_id = paid.eleve_id AND due.groupe_id = paid.groupe_id
          WHERE COALESCE(paid.paid_total, 0) < due.due_total
        ) sub`,
      ),
    ]);

  return {
    totalStudents: Number(totalStudents),
    totalTeachers: Number(totalTeachers),
    totalSeances: Number(totalSeances),
    totalRevenue: Number(totalRevenue._sum.montant || 0),
    totalUnpaid: Number((totalUnpaid as any)[0]?.total || 0),
  };
}
