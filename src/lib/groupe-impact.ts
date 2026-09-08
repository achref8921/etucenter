import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | PrismaClient;

export interface GroupeFinanceImpact {
  seances: number;
  presences: number;
  consommations: { count: number; montant: number };
  paiements: { count: number; montant: number };
  gainsProf: { count: number; montant: number };
}

const EMPTY_IDS = ["00000000-0000-0000-0000-000000000000"];

export async function computeGroupeDeleteImpact(
  centerId: string,
  groupeId: string,
  db: Db = prisma
): Promise<GroupeFinanceImpact> {
  const [seances, presenceRows] = await Promise.all([
    db.seance.count({ where: { groupeId } }),
    db.presence.findMany({ where: { seance: { groupeId } }, select: { id: true } }),
  ]);

  const presenceIds = presenceRows.map((p) => p.id);
  const safeIds = presenceIds.length > 0 ? presenceIds : EMPTY_IDS;

  let consommations = { count: 0, montant: 0 };
  if (presenceIds.length > 0) {
    const rows = await db.studentTransaction.findMany({
      where: { attendanceId: { in: safeIds } },
      select: { id: true, signedAmount: true, type: true },
    });
    const reversals = await db.studentTransaction.findMany({
      where: { reversalOfId: { in: rows.map((r) => r.id) } },
      select: { id: true },
    });
    const billed = rows
      .filter((r) => r.signedAmount !== null && Number(r.signedAmount) < 0)
      .reduce((sum, r) => sum + Math.abs(Number(r.signedAmount)), 0);
    consommations = {
      count: rows.length + reversals.length,
      montant: Math.round(billed * 100) / 100,
    };
  }

  const paiementAgg = await db.paiement.aggregate({
    where: { groupeId },
    _count: { id: true },
    _sum: { montant: true },
  });

  let gainsProf = { count: 0, montant: 0 };
  const paiements = await db.paiement.findMany({ where: { groupeId }, select: { id: true } });
  if (paiements.length > 0) {
    const refs = paiements.map((p) => `paiement:${p.id}`);
    const gainAgg = await db.teacherTransaction.aggregate({
      where: { centerId, reference: { in: refs }, type: "EARNING", status: "active" },
      _count: { id: true },
      _sum: { signedAmount: true },
    });
    gainsProf = {
      count: gainAgg._count.id ?? 0,
      montant: Math.abs(Number(gainAgg._sum.signedAmount ?? 0)),
    };
  }

  return {
    seances,
    presences: presenceIds.length,
    consommations,
    paiements: {
      count: paiementAgg._count.id ?? 0,
      montant: Number(paiementAgg._sum.montant ?? 0),
    },
    gainsProf,
  };
}

export function hasSensitiveGroupeImpact(impact: GroupeFinanceImpact): boolean {
  return (
    impact.seances > 0 ||
    impact.consommations.count > 0 ||
    impact.paiements.count > 0 ||
    impact.gainsProf.count > 0
  );
}

/**
 * Supprime un groupe en contrôlant l'impact financier, dans une seule transaction.
 *
 * mode "full" : supprime aussi les opérations de consommation liées aux séances du groupe
 *   (et leurs contre-opérations) ainsi que les gains professeur liés aux paiements du groupe.
 *   Les soldes des élèves reprennent ainsi leur valeur réelle d'avant l'erreur.
 * mode "only" : seul le groupe est supprimé (les opérations financières liées restent
 *   dans les portefeuilles des élèves, sans référence visible).
 */
export async function deleteGroupeWithFinancialControl(
  groupeId: string,
  mode: "only" | "full",
  centerId: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const presenceRows = await tx.presence.findMany({
      where: { seance: { groupeId } },
      select: { id: true },
    });
    const presenceIds = presenceRows.map((p) => p.id);

    if (mode === "full") {
      if (presenceIds.length > 0) {
        const consumptions = await tx.studentTransaction.findMany({
          where: { attendanceId: { in: presenceIds } },
          select: { id: true },
        });
        const consumptionIds = consumptions.map((c) => c.id);
        if (consumptionIds.length > 0) {
          await tx.studentTransaction.deleteMany({
            where: {
              OR: [{ id: { in: consumptionIds } }, { reversalOfId: { in: consumptionIds } }],
            },
          });
        }
      }

      const paiements = await tx.paiement.findMany({ where: { groupeId }, select: { id: true } });
      if (paiements.length > 0) {
        const refs = paiements.map((p) => `paiement:${p.id}`);
        const earnings = await tx.teacherTransaction.findMany({
          where: { centerId, reference: { in: refs }, type: "EARNING", status: "active" },
          select: { id: true },
        });
        const earningIds = earnings.map((e) => e.id);
        if (earningIds.length > 0) {
          await tx.teacherTransaction.deleteMany({
            where: {
              OR: [{ id: { in: earningIds } }, { reversalOfId: { in: earningIds } }],
            },
          });
        }
      }
    }

    await tx.groupe.delete({ where: { id: groupeId } });
  });
}