import { prisma } from "@/lib/prisma";
import { finalizePassedSeances } from "@/lib/seance-finalizer";
import {
  centerSharePercent,
  getTeacherDashboardFinance,
  getTeacherProfit,
  monthRange,
} from "@/lib/teacher-finance";

export interface ProfDashboardGroup {
  id: string;
  nom: string;
  prixParSeance: number;
  nbEleves: number;
  nbSeances: number;
}

export interface ProfDashboardStats {
  tauxPourcentage: number;
  impayeNet: number;
  claimable: number;
  profit: {
    total: number;
    studentShare: number;
    reverseNet: number;
    adjustments: number;
  };
  totalEleves: number;
  totalSeances: number;
  totalSeancesTerminees: number;
  groupes: ProfDashboardGroup[];
}

export interface ProfDashboardSeance {
  id: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  groupe: { id: string; nom: string };
  _count: { presences: number };
}

export async function getProfDashboardStats(
  profId: string,
  centerId: string
): Promise<ProfDashboardStats> {
  const { from, to } = monthRange();
  const [tauxBenefice, groupes, presencesTerminees, dashboardFinance, profit] =
    await Promise.all([
      prisma.tauxBenefice.findUnique({ where: { profId } }),
      prisma.groupe.findMany({
        where: { profId },
        select: {
          id: true,
          nom: true,
          prixParSeance: true,
          _count: {
            select: {
              inscriptions: { where: { statut: "actif" } },
              seances: true,
            },
          },
        },
      }),
      prisma.presence.count({
        where: {
          statut: "present",
          seance: {
            groupe: { profId },
            statut: "terminee",
          },
        },
      }),
      getTeacherDashboardFinance(centerId, profId),
      getTeacherProfit({ centerId, teacherId: profId, from, to }),
    ]);

  const centreShare = centerSharePercent(tauxBenefice);
  const profShare = Math.max(0, Math.min(100, 100 - centreShare));

  return {
    tauxPourcentage: profShare,
    impayeNet: dashboardFinance.impayeNet,
    claimable: dashboardFinance.claimable,
    profit,
    totalEleves: groupes.reduce((sum, groupe) => sum + groupe._count.inscriptions, 0),
    totalSeances: groupes.reduce((sum, groupe) => sum + groupe._count.seances, 0),
    totalSeancesTerminees: presencesTerminees,
    groupes: groupes.map((groupe) => ({
      id: groupe.id,
      nom: groupe.nom,
      prixParSeance: Number(groupe.prixParSeance),
      nbEleves: groupe._count.inscriptions,
      nbSeances: groupe._count.seances,
    })),
  };
}

export async function getProfUpcomingSeances(
  profId: string,
  centerId: string,
  limit = 5
): Promise<ProfDashboardSeance[]> {
  await finalizePassedSeances(centerId);

  const seances = await prisma.seance.findMany({
    where: { groupe: { profId, centerId } },
    include: {
      groupe: { select: { id: true, nom: true } },
      _count: { select: { presences: true } },
    },
    orderBy: { date: "desc" },
  });

  const now = new Date();
  return seances
    .filter((seance) => new Date(seance.date) >= now && seance.statut !== "annulee")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit)
    .reverse()
    .map((seance) => ({
      id: seance.id,
      date: seance.date.toISOString(),
      heureDebut: seance.heureDebut?.toISOString() ?? null,
      heureFin: seance.heureFin?.toISOString() ?? null,
      statut: seance.statut,
      groupe: seance.groupe,
      _count: seance._count,
    }));
}
