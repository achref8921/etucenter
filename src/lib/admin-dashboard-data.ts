import { prisma } from "./prisma";
import { DEFAULT_CENTER_SHARE, getTeacherDashboardFinance, round2 } from "./teacher-finance";

export interface DashboardMonthData {
  selectedMonth: string;
  netCenterEarnings: number;
  totalCenterBenefit: number;
  netPaidSessionsRevenue: number;
  totalUnpaid: number;
  totalStudents: number;
  totalTeachers: number;
  reverseSettledRevenue: number;
  reversePendingBalance: number;
  profs: {
    prof: { id: string; nom: string; prenom: string };
    taux: number;
    netRevenue: number;
    beneficeCentre: number;
    reverseSettledRevenue: number;
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
    where: { role: "prof", centerId, deletedAt: null, ghost: false },
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
      ? prisma.$queryRawUnsafe<
          { prof_id: string | null; net_revenue: number; benefice_centre: number }[]
        >(
          `
          SELECT g.prof_id,
                 COALESCE(SUM(pa.montant), 0)::float AS net_revenue,
                 COALESCE(SUM(COALESCE(pa.part_centre, (pa.montant * COALESCE(tb.taux_pourcentage, 20)) / 100)), 0)::float AS benefice_centre
          FROM paiements pa
          JOIN groupes g ON pa.groupe_id = g.id
          LEFT JOIN taux_benefices tb ON tb.prof_id = g.prof_id
          WHERE g.center_id = $1::uuid
            AND pa.date_paiement >= $2::timestamptz
            AND pa.date_paiement <= $3::timestamptz
            AND pa.collecte_par_prof = false
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

  const revenueMap = new Map<string, number>();
  const centreMap = new Map<string, number>();
  for (const r of netRevenueByProf) {
    revenueMap.set(r.prof_id ?? "", Number(r.net_revenue || 0));
    centreMap.set(r.prof_id ?? "", Number(r.benefice_centre || 0));
  }
  const countMap = new Map<string, number>();
  for (const r of eleveCounts) countMap.set(r.prof_id ?? "", Number(r.nb || 0));

  let totalNetRevenue = 0;
  let totalCenterEarnings = 0;

  const profsData = profs.map((e) => {
    const taux = tauxMap.get(e.id) ?? DEFAULT_CENTER_SHARE;
    const netRevenue = revenueMap.get(e.id) || 0;
    const beneficeCentre = round2(centreMap.get(e.id) || 0);
    const salaireProf = round2(netRevenue - beneficeCentre);
    totalNetRevenue += netRevenue;
    totalCenterEarnings += beneficeCentre;
    return {
      prof: { id: e.id, nom: e.nom, prenom: e.prenom },
      taux,
      netRevenue,
      beneficeCentre,
      reverseSettledRevenue: 0,
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
          SUM(
            CASE
              WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
              THEN (i.forfait_montant / i.forfait_seances)
              ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
            END
          ) as due_total
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
        WHERE pr.statut = 'present' AND s.statut <> 'annulee' AND g.center_id = $1::uuid
        GROUP BY pr.eleve_id, s.groupe_id
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

  const [totalStudents, totalTeachers, reverseSettledRows, reversePending] = await Promise.all([
    prisma.utilisateur.count({ where: { role: "eleve", centerId, deletedAt: null, ghost: false } }),
    prisma.utilisateur.count({ where: { role: "prof", centerId, deletedAt: null, ghost: false } }),
    prisma.teacherTransaction.groupBy({
      by: ["teacherId"],
      where: {
        centerId,
        mode: "REVERSE",
        type: "CENTER_SETTLEMENT",
        status: "active",
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    }),
    prisma.teacherCenterDebt.aggregate({
      _sum: { balance: true },
      where: {
        centerId,
        status: { in: ["OPEN", "PARTIAL"] },
      },
    }),
  ]);

  const reverseSettledMap = new Map<string, number>();
  for (const row of reverseSettledRows) {
    reverseSettledMap.set(row.teacherId, round2(Number(row._sum.amount ?? 0)));
  }

  let totalReverseSettled = 0;
  for (const pd of profsData) {
    const rev = reverseSettledMap.get(pd.prof.id) ?? 0;
    pd.reverseSettledRevenue = rev;
    totalReverseSettled += rev;
  }

  return {
    selectedMonth: month,
    netCenterEarnings: totalCenterEarnings,
    totalCenterBenefit: round2(totalCenterEarnings + totalReverseSettled),
    netPaidSessionsRevenue: totalNetRevenue,
    totalUnpaid: Number(unpaidResult[0]?.total || 0),
    totalStudents,
    totalTeachers,
    reverseSettledRevenue: round2(totalReverseSettled),
    reversePendingBalance: round2(Number(reversePending._sum.balance ?? 0)),
    profs: profsData,
  };
}

export interface UnpaidStudentGroup {
  id: string;
  nom: string;
  matiere: string | null;
  unpaid: number;
}

export interface UnpaidStudentRow {
  student: {
    id: string;
    nom: string;
    prenom: string;
    codeEleve: string | null;
    classe: string | null;
  };
  totalUnpaid: number;
  groups: UnpaidStudentGroup[];
}

export async function getUnpaidStudents(centerId: string): Promise<UnpaidStudentRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    {
      eleve_id: string;
      groupe_id: string;
      unpaid: number;
      nom: string;
      prenom: string;
      code_eleve: string | null;
      classe: string | null;
      groupe_nom: string;
      matiere_nom: string | null;
    }[]
  >(
    `
    WITH due AS (
      SELECT pr.eleve_id, s.groupe_id,
        SUM(
          CASE
            WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
            THEN (i.forfait_montant / i.forfait_seances)
            ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
          END
        ) AS due_total
      FROM presences pr
      JOIN seances s ON pr.seance_id = s.id
      JOIN groupes g ON s.groupe_id = g.id
      LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
      WHERE pr.statut = 'present' AND s.statut <> 'annulee' AND g.center_id = $1::uuid
      GROUP BY pr.eleve_id, s.groupe_id
    ),
    paid AS (
      SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) AS paid_total
      FROM paiements pai
      JOIN groupes g2 ON pai.groupe_id = g2.id
      WHERE g2.center_id = $1::uuid
      GROUP BY pai.eleve_id, pai.groupe_id
    )
    SELECT due.eleve_id, due.groupe_id,
           (due.due_total - COALESCE(paid.paid_total, 0))::float AS unpaid,
           u.nom, u.prenom, u.code_eleve, u.classe,
           g.nom AS groupe_nom, m.nom AS matiere_nom
    FROM due
    JOIN utilisateurs u ON u.id = due.eleve_id
      AND u.role = 'eleve' AND u.deleted_at IS NULL AND u.ghost = false
    JOIN groupes g ON g.id = due.groupe_id
    LEFT JOIN matieres m ON m.id = g.matiere_id
    LEFT JOIN paid ON paid.eleve_id = due.eleve_id AND paid.groupe_id = due.groupe_id
    WHERE due.due_total > COALESCE(paid.paid_total, 0)
    ORDER BY unpaid DESC
    `,
    centerId
  );

  const byStudent = new Map<string, UnpaidStudentRow>();

  for (const row of rows) {
    const unpaid = round2(Number(row.unpaid || 0));
    if (unpaid <= 0) continue;

    const entry =
      byStudent.get(row.eleve_id) ??
      {
        student: {
          id: row.eleve_id,
          nom: row.nom,
          prenom: row.prenom,
          codeEleve: row.code_eleve,
          classe: row.classe,
        },
        totalUnpaid: 0,
        groups: [],
      };

    entry.totalUnpaid = round2(entry.totalUnpaid + unpaid);
    entry.groups.push({
      id: row.groupe_id,
      nom: row.groupe_nom,
      matiere: row.matiere_nom,
      unpaid,
    });
    byStudent.set(row.eleve_id, entry);
  }

  const result = Array.from(byStudent.values());
  for (const entry of result) {
    entry.groups.sort((a, b) => b.unpaid - a.unpaid);
  }
  return result.sort((a, b) => b.totalUnpaid - a.totalUnpaid);
}

export interface PendingCenterPartDebt {
  id: string;
  date: Date;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: string;
  student: { id: string; nom: string; prenom: string } | null;
}

export interface PendingCenterPartProf {
  prof: { id: string; nom: string; prenom: string };
  balance: number;
  debts: PendingCenterPartDebt[];
}

export async function getReversePendingCenterParts(
  centerId: string
): Promise<PendingCenterPartProf[]> {
  const reversePendingDebts = await prisma.teacherCenterDebt.findMany({
    where: {
      centerId,
      status: { in: ["OPEN", "PARTIAL"] },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      createdAt: true,
      amountDue: true,
      amountPaid: true,
      balance: true,
      status: true,
      teacher: { select: { id: true, nom: true, prenom: true } },
      student: { select: { id: true, nom: true, prenom: true } },
    },
  });

  const pendingProfMap = new Map<string, PendingCenterPartProf>();

  for (const d of reversePendingDebts) {
    const balance = round2(Number(d.balance));
    if (balance <= 0) continue;
    const entry =
      pendingProfMap.get(d.teacher.id) ?? { prof: d.teacher, balance: 0, debts: [] };
    entry.balance = round2(entry.balance + balance);
    entry.debts.push({
      id: d.id,
      date: d.createdAt,
      amountDue: Number(d.amountDue),
      amountPaid: Number(d.amountPaid),
      balance,
      status: d.status,
      student: d.student,
    });
    pendingProfMap.set(d.teacher.id, entry);
  }

  return Array.from(pendingProfMap.values()).sort((a, b) => b.balance - a.balance);
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
