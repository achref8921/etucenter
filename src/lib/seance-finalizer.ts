import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ACTIVE_STATUSES = ["planifiee", "en_cours"] as const;

export async function finalizePassedSeances(centerId?: string, now: Date = new Date()): Promise<number> {
  const dateStr = now.toISOString().split("T")[0];
  const dayStart = new Date(`${dateStr}T00:00:00`);

  const whereBase: any = {
    statut: { in: [...ACTIVE_STATUSES] },
    ...(centerId ? { groupe: { centerId } } : {}),
  };

  const previousDays = await prisma.seance.updateMany({
    where: { ...whereBase, date: { lt: dayStart } },
    data: { statut: "terminee" },
  });

  const todaySeances = await prisma.seance.findMany({
    where: { ...whereBase, date: dayStart },
    select: { id: true, heureDebut: true, heureFin: true },
  });

  const toFinalize: string[] = [];
  for (const s of todaySeances) {
    const t = s.heureFin || s.heureDebut;
    const end = new Date(`${dateStr}T${t ? t.toISOString().split("T")[1] : "23:59:59"}`);
    if (now > end) toFinalize.push(s.id);
  }

  let todayCount = 0;
  if (toFinalize.length > 0) {
    const result = await prisma.seance.updateMany({
      where: { id: { in: toFinalize } },
      data: { statut: "terminee" },
    });
    todayCount = result.count;
  }

  const total = previousDays.count + todayCount;
  if (total > 0) {
    logger.info("Séances finalisées automatiquement", { centerId, count: total });
  }
  return total;
}
