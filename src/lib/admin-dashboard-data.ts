import { prisma } from "./prisma";
import { DEFAULT_CENTER_SHARE } from "./teacher-finance";

export interface DashboardMonthData {
  selectedMonth: string;
  totalRecu: number;
  totalBenefice: number;
  totalSalaire: number;
  totalUnpaid: number;
  totalStudents: number;
  totalTeachers: number;
  profs: {
    prof: { id: string; nom: string; prenom: string };
    taux: number;
    totalRecu: number;
    beneficeCentre: number;
    salaireProf: number;
    nombreEleves: number;
  }[];
}

export async function getAdminDashboardMonthData(
  centerId: string,
  month: string
): Promise<DashboardMonthData> {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);

  const profs = await prisma.utilisateur.findMany({
    where: { role: "prof", centerId, deletedAt: null },
    select: {
      id: true,
      nom: true,
      prenom: true,
      tauxBenefice: { select: { tauxPourcentage: true } },
    },
  });

  const profIds = profs.map((p) => p.id);

  const [monthPayments, eleveCounts] = await Promise.all([
    profIds.length
      ? prisma.$queryRawUnsafe<{ prof_id: string | null; total: number }[]>(
          `
          SELECT g.prof_id, COALESCE(SUM(pa.montant), 0)::float AS total
          FROM paiements pa JOIN groupes g ON pa.groupe_id = g.id
          WHERE g.center_id = $1::uuid
            AND pa.date_paiement >= $2::timestamptz
            AND pa.date_paiement <= $3::timestamptz
          GROUP BY g.prof_id
          `,
          centerId,
          startDate,
          endDate
        )
      : [],
    profIds.length
      ? prisma.$queryRawUnsafe<{ prof_id: string | null; nb: number }[]>(
          `
          SELECT g.prof_id, COUNT(DISTINCT i.eleve_id)::int AS nb
          FROM inscriptions i JOIN groupes g ON i.groupe_id = g.id
          WHERE g.center_id = $1::uuid AND i.statut = 'actif'
          GROUP BY g.prof_id
          `,
          centerId
        )
      : [],
  ]);

  const monthMap = new Map<string, number>();
  for (const r of monthPayments) monthMap.set(r.prof_id ?? "", Number(r.total || 0));
  const countMap = new Map<string, number>();
  for (const r of eleveCounts) countMap.set(r.prof_id ?? "", Number(r.nb || 0));

  const tauxMap = new Map<string, number>(
    profs.map((p) => [
      p.id,
      p.tauxBenefice ? Number(p.tauxBenefice.tauxPourcentage) : DEFAULT_CENTER_SHARE,
    ])
  );

  let totalRecu = 0;
  let totalBenefice = 0;

  const profsData = profs.map((e) => {
    const taux = tauxMap.get(e.id) ?? DEFAULT_CENTER_SHARE;
    const totalRecuP = monthMap.get(e.id) || 0;
    const beneficeCentre = (totalRecuP * taux) / 100;
    const salaireProf = totalRecuP - beneficeCentre;
    totalRecu += totalRecuP;
    totalBenefice += beneficeCentre;
    return {
      prof: { id: e.id, nom: e.nom, prenom: e.prenom },
      taux,
      totalRecu: totalRecuP,
      beneficeCentre,
      salaireProf,
      nombreEleves: countMap.get(e.id) || 0,
    };
  });

  const unpaidResult = await prisma.$queryRawUnsafe<{ total: number }[]>(
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
        SELECT pr.eleve_id, s.groupe_id,
          COALESCE(s.prix_par_seance, g.prix_par_seance) * COUNT(*) as due_total
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        WHERE pr.statut = 'present' AND s.statut = 'terminee' AND g.center_id = $1::uuid
        GROUP BY pr.eleve_id, s.groupe_id, s.prix_par_seance, g.prix_par_seance
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
  );

  const [totalStudents, totalTeachers] = await Promise.all([
    prisma.utilisateur.count({ where: { role: "eleve", centerId, deletedAt: null } }),
    prisma.utilisateur.count({ where: { role: "prof", centerId, deletedAt: null } }),
  ]);

  return {
    selectedMonth: month,
    totalRecu,
    totalBenefice,
    totalSalaire: totalRecu - totalBenefice,
    totalUnpaid: Number(unpaidResult[0]?.total || 0),
    totalStudents,
    totalTeachers,
    profs: profsData,
  };
}
