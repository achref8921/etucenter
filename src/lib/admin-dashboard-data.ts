import { prisma } from "./prisma";
import { DEFAULT_CENTER_SHARE, getTeacherDashboardFinance } from "./teacher-finance";

export interface DashboardMonthData {
  selectedMonth: string;
  netCenterEarnings: number;
  netPaidSessionsRevenue: number;
  totalUnpaid: number;
  totalStudents: number;
  totalTeachers: number;
  profs: {
    prof: { id: string; nom: string; prenom: string };
    taux: number;
    netRevenue: number;
    beneficeCentre: number;
    salaireProf: number;
    claimable: number;
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

  const tauxMap = new Map<string, number>(
    profs.map((p) => [
      p.id,
      p.tauxBenefice ? Number(p.tauxBenefice.tauxPourcentage) : DEFAULT_CENTER_SHARE,
    ])
  );

  const profIds = profs.map((p) => p.id);

  const [netRevenueByProf, eleveCounts] = await Promise.all([
    profIds.length
      ? prisma.$queryRawUnsafe<{ prof_id: string; net_revenue: number }[]>(
          `
          WITH all_sessions AS (
            SELECT
              pr.eleve_id,
              s.groupe_id,
              COALESCE(s.prix_par_seance, g.prix_par_seance) as price,
              s.date as seance_date
            FROM presences pr
            JOIN seances s ON pr.seance_id = s.id
            JOIN groupes g ON s.groupe_id = g.id
            WHERE pr.statut = 'present'
              AND s.statut = 'terminee'
              AND g.center_id = $1::uuid
              AND s.date <= $2::timestamptz
          ),
          student_dues AS (
            SELECT
              eleve_id, groupe_id,
              SUM(price) as total_due,
              SUM(CASE WHEN seance_date >= $3::timestamptz THEN price ELSE 0 END) as due_this_month
            FROM all_sessions
            GROUP BY eleve_id, groupe_id
          ),
          student_payments AS (
            SELECT
              pai.eleve_id,
              pai.groupe_id,
              SUM(pai.montant) as total_paid
            FROM paiements pai
            JOIN groupes g ON pai.groupe_id = g.id
            WHERE g.center_id = $1::uuid
              AND pai.date_paiement <= $2::timestamptz
            GROUP BY pai.eleve_id, pai.groupe_id
          ),
          paid_this_month AS (
            SELECT
              sd.eleve_id,
              sd.groupe_id,
              GREATEST(0,
                LEAST(sd.due_this_month,
                  GREATEST(0, COALESCE(sp.total_paid, 0) - (sd.total_due - sd.due_this_month))
                )
              ) as paid_amount
            FROM student_dues sd
            LEFT JOIN student_payments sp
              ON sd.eleve_id = sp.eleve_id AND sd.groupe_id = sp.groupe_id
            WHERE sd.due_this_month > 0
          )
          SELECT
            g.prof_id,
            COALESCE(SUM(pm.paid_amount), 0)::float as net_revenue
          FROM paid_this_month pm
          JOIN groupes g ON pm.groupe_id = g.id
          GROUP BY g.prof_id
          `,
          centerId,
          endDate,
          startDate
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

  const revenueMap = new Map<string, number>();
  for (const r of netRevenueByProf) revenueMap.set(r.prof_id, Number(r.net_revenue || 0));
  const countMap = new Map<string, number>();
  for (const r of eleveCounts) countMap.set(r.prof_id ?? "", Number(r.nb || 0));

  let totalNetRevenue = 0;
  let totalCenterEarnings = 0;

  const profsData = profs.map((e) => {
    const taux = tauxMap.get(e.id) ?? DEFAULT_CENTER_SHARE;
    const netRevenue = revenueMap.get(e.id) || 0;
    const beneficeCentre = (netRevenue * taux) / 100;
    const salaireProf = netRevenue - beneficeCentre;
    totalNetRevenue += netRevenue;
    totalCenterEarnings += beneficeCentre;
    return {
      prof: { id: e.id, nom: e.nom, prenom: e.prenom },
      taux,
      netRevenue,
      beneficeCentre,
      salaireProf,
      claimable: 0,
      nombreEleves: countMap.get(e.id) || 0,
    };
  });

  const claimableResults = await Promise.all(
    profs.map((p) => getTeacherDashboardFinance(centerId, p.id))
  );
  profs.forEach((p, i) => {
    const entry = profsData.find((pd) => pd.prof.id === p.id);
    if (entry) entry.claimable = claimableResults[i].claimable;
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
    netCenterEarnings: totalCenterEarnings,
    netPaidSessionsRevenue: totalNetRevenue,
    totalUnpaid: Number(unpaidResult[0]?.total || 0),
    totalStudents,
    totalTeachers,
    profs: profsData,
  };
}

export interface TodaySeance {
  id: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  notes: string | null;
  prixParSeance: number | null;
  groupe: { id: string; nom: string; matiere: { nom: string } | null };
  prof: { id: string; nom: string; prenom: string } | null;
  elevesCount: number;
}

export async function getAdminTodaySeances(centerId: string): Promise<TodaySeance[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const seances = await prisma.seance.findMany({
    where: {
      date: { gte: start, lte: end },
      groupe: { centerId },
      statut: { not: "annulee" },
    },
    select: {
      id: true,
      date: true,
      heureDebut: true,
      heureFin: true,
      statut: true,
      notes: true,
      prixParSeance: true,
      groupe: {
        select: {
          id: true,
          nom: true,
          matiere: { select: { nom: true } },
          prof: { select: { id: true, nom: true, prenom: true } },
        },
      },
      _count: { select: { presences: true } },
    },
    orderBy: [{ heureDebut: "asc" }, { createdAt: "desc" }],
  });

  return seances.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    heureDebut: s.heureDebut ? s.heureDebut.toISOString() : null,
    heureFin: s.heureFin ? s.heureFin.toISOString() : null,
    statut: s.statut,
    notes: s.notes,
    prixParSeance: s.prixParSeance ? Number(s.prixParSeance) : null,
    groupe: { id: s.groupe.id, nom: s.groupe.nom, matiere: s.groupe.matiere },
    prof: s.groupe.prof,
    elevesCount: s._count.presences,
  }));
}
