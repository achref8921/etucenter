import { prisma } from "./prisma";

export async function calculateTotalDue(eleveId: string, groupeId: string): Promise<number> {
  const presencesCount = await prisma.presence.count({
    where: {
      eleveId,
      statut: "present",
      seance: {
        groupeId,
        statut: "terminee",
      },
    },
  });

  const groupe = await prisma.groupe.findUnique({
    where: { id: groupeId },
    select: { prixParSeance: true },
  });

  if (!groupe) return 0;

  return Number(groupe.prixParSeance);
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
    include: { groupe: true },
  });

  const stats = await Promise.all(
    inscriptions.map(async (inscription: any) => {
      const totalDue = await calculateTotalDue(eleveId, inscription.groupeId);
      const totalPaid = await calculateTotalPaid(eleveId, inscription.groupeId);
      const presencesCount = await prisma.presence.count({
        where: { eleveId, statut: "present", seance: { groupeId: inscription.groupeId } },
      });
      const absencesCount = await prisma.presence.count({
        where: { eleveId, statut: "absent", seance: { groupeId: inscription.groupeId } },
      });

      return {
        groupeId: inscription.groupeId,
        groupeNom: inscription.groupe.nom,
        prixParSeance: Number(inscription.groupe.prixParSeance),
        presencesCount,
        absencesCount,
        totalDue,
        totalPaid,
        unpaid: totalDue - totalPaid,
      };
    })
  );

  return stats;
}

export async function getAdminStats(centerId: string) {
  const [totalStudents, totalTeachers, totalSeances, totalRevenue, totalUnpaid] =
    await Promise.all([
      prisma.utilisateur.count({ where: { role: "eleve", centerId } }),
      prisma.utilisateur.count({ where: { role: "prof", centerId } }),
      prisma.seance.count({ where: { statut: "terminee", groupe: { centerId } } }),
      prisma.paiement.aggregate({ _sum: { montant: true }, where: { groupe: { centerId } } }),
      prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(remaining), 0) as total FROM (
          SELECT 
            due.eleve_id,
            due.groupe_id,
            CASE 
              WHEN COALESCE(paid.paid_total, 0) < due.due_total 
              THEN due.due_total - COALESCE(paid.paid_total, 0) 
              ELSE 0 
            END as remaining
          FROM (
            SELECT pr.eleve_id, s.groupe_id, g.prix_par_seance as due_total
            FROM presences pr
            JOIN seances s ON pr.seance_id = s.id
            JOIN groupes g ON s.groupe_id = g.id
            WHERE pr.statut = 'present' AND s.statut = 'terminee' AND g.center_id = $1::uuid
            GROUP BY pr.eleve_id, s.groupe_id, g.prix_par_seance
          ) due
          LEFT JOIN (
            SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) as paid_total
            FROM paiements pai
            JOIN groupes g2 ON pai.groupe_id = g2.id
            WHERE g2.center_id = $1::uuid
            GROUP BY pai.eleve_id, pai.groupe_id
          ) paid ON due.eleve_id = paid.eleve_id AND due.groupe_id = paid.groupe_id
          WHERE COALESCE(paid.paid_total, 0) < due.due_total
        ) sub`,
        centerId
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
