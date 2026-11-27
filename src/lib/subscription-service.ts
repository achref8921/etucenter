import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendPushToUsers } from "@/lib/push";

const DAY_MS = 86_400_000;
const GRACE_DAYS = 3;
const REMINDER_DAYS_BEFORE = 3;

export type SubscriptionDuration = "month" | "quarter" | "year";

export const SUBSCRIPTION_DURATIONS: SubscriptionDuration[] = ["month", "quarter", "year"];

export type SubscriptionState =
  | "none"
  | "active"
  | "due_soon"
  | "due_today"
  | "grace"
  | "overdue"
  | "suspended";

export interface SubscriptionOverview {
  centerId: string;
  centerName: string;
  centerActive: boolean;
  usersCount: number;
  subscriptionId: string | null;
  montant: number;
  duree: string | null;
  lastPaymentDate: string | null;
  periodStart: string | null;
  dateFin: string | null;
  daysLeft: number | null;
  daysSincePayment: number | null;
  periodDays: number | null;
  progress: number;
  paidThisMonth: boolean;
  suspendedAt: string | null;
  state: SubscriptionState;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Nombre de jours calendaires entre deux dates (négatif si `to` est passé). */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function addDuration(date: Date, duree: SubscriptionDuration): Date {
  const months = duree === "month" ? 1 : duree === "quarter" ? 3 : 12;
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Évite le débordement (31 janvier + 1 mois ≠ 3 mars).
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function sameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAmount(value: unknown): string {
  return Number(value ?? 0).toLocaleString("fr-TN");
}

function durationLabel(duree: string | null | undefined): string {
  if (duree === "quarter") return "trimestre";
  if (duree === "year") return "année";
  return "mois";
}

async function notifySuperAdmins(opts: {
  centerId: string;
  type: string;
  titre: string;
  message: string;
  dedupeSameDay?: boolean;
}): Promise<number> {
  const admins = await prisma.utilisateur.findMany({
    where: { role: "super_admin", actif: true, deletedAt: null },
    select: { id: true },
  });
  if (admins.length === 0) return 0;

  const todayStart = startOfUtcDay(new Date());
  let created = 0;

  for (const admin of admins) {
    if (opts.dedupeSameDay) {
      const existing = await prisma.notification.findFirst({
        where: {
          destinataireId: admin.id,
          centerId: opts.centerId,
          type: opts.type,
          createdAt: { gte: todayStart },
        },
        select: { id: true },
      });
      if (existing) continue;
    }

    try {
      await prisma.notification.create({
        data: {
          centerId: opts.centerId,
          destinataireId: admin.id,
          titre: opts.titre,
          message: opts.message,
          type: opts.type,
          lien: "/super-admin/abonnements",
        },
      });
      created++;
    } catch (error) {
      logger.warn("Impossible de créer une notification d'abonnement", { error });
    }
  }

  if (created > 0) {
    sendPushToUsers(
      admins.map((a) => a.id),
      { title: opts.titre, body: opts.message, url: "/super-admin/abonnements" }
    ).catch(() => {});
  }

  return created;
}

export async function getSubscriptionOverviews(): Promise<SubscriptionOverview[]> {
  const now = new Date();
  const today = startOfUtcDay(now);

  const centers = await prisma.center.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { utilisateurs: true } },
      subscriptions: {
        where: { statut: { in: ["active", "expired"] } },
        orderBy: [{ dateFin: "desc" }],
        take: 1,
      },
    },
  });

  return centers.map((center) => {
    const sub = center.subscriptions[0] ?? null;
    const base: SubscriptionOverview = {
      centerId: center.id,
      centerName: center.name,
      centerActive: center.active,
      usersCount: center._count.utilisateurs,
      subscriptionId: null,
      montant: 0,
      duree: null,
      lastPaymentDate: null,
      periodStart: null,
      dateFin: null,
      daysLeft: null,
      daysSincePayment: null,
      periodDays: null,
      progress: 0,
      paidThisMonth: false,
      suspendedAt: center.subscriptionSuspendedAt?.toISOString() ?? null,
      state: "none",
    };

    if (!sub) {
      base.state = center.subscriptionSuspendedAt ? "suspended" : "none";
      return base;
    }

    const due = startOfUtcDay(sub.dateFin);
    const daysLeft = daysBetween(today, due);
    const periodDays = Math.max(1, daysBetween(sub.dateDebut, sub.dateFin));
    const elapsed = Math.max(0, Math.min(periodDays, daysBetween(sub.dateDebut, today)));
    const lastPayment = sub.paidAt ?? sub.dateDebut;

    let state: SubscriptionState = "active";
    if (center.subscriptionSuspendedAt) {
      state = "suspended";
    } else if (daysLeft < 0) {
      state = daysLeft >= -GRACE_DAYS ? "grace" : "overdue";
    } else if (daysLeft === 0) {
      state = "due_today";
    } else if (daysLeft <= REMINDER_DAYS_BEFORE) {
      state = "due_soon";
    }

    if (!center.active && state !== "suspended") state = "overdue";

    return {
      ...base,
      subscriptionId: sub.id,
      montant: Number(sub.montant),
      duree: sub.duree,
      lastPaymentDate: lastPayment.toISOString(),
      periodStart: sub.dateDebut.toISOString(),
      dateFin: sub.dateFin.toISOString(),
      daysLeft,
      daysSincePayment: Math.max(0, daysBetween(lastPayment, today)),
      periodDays,
      progress: Math.round((elapsed / periodDays) * 100),
      paidThisMonth: sameUtcMonth(lastPayment, now),
      state,
    };
  });
}

export async function recordSubscriptionPayment(input: {
  centerId: string;
  montant: number;
  duree: SubscriptionDuration;
  notes?: string | null;
}): Promise<{
  subscription: {
    id: string;
    dateDebut: Date;
    dateFin: Date;
    montant: number;
    paidAt: Date;
    duree: string;
  };
  centerName: string;
  daysRemaining: number;
  alreadyPaidThisMonth: boolean;
}> {
  const { centerId, montant, duree } = input;
  if (!centerId) throw new Error("Centre manquant");
  if (!Number.isFinite(montant) || montant < 0) throw new Error("Montant invalide");
  if (!SUBSCRIPTION_DURATIONS.includes(duree)) throw new Error("Durée d'abonnement invalide");

  const center = await prisma.center.findUnique({ where: { id: centerId } });
  if (!center) throw new Error("Centre introuvable");

  const now = new Date();
  const latest = await prisma.centerSubscription.findFirst({
    where: { centerId, statut: { in: ["active", "expired"] } },
    orderBy: [{ dateFin: "desc" }],
  });

  // Renouvellement anticipé : la nouvelle période démarre à la fin de l'ancienne.
  const start = latest && latest.dateFin.getTime() > now.getTime() ? latest.dateFin : now;
  const dateFin = addDuration(start, duree);

  const referencePayment = latest?.paidAt ?? latest?.dateDebut ?? null;
  const alreadyPaidThisMonth = referencePayment ? sameUtcMonth(referencePayment, now) : false;

  const subscription = await prisma.$transaction(async (tx) => {
    await tx.centerSubscription.updateMany({
      where: { centerId, statut: "active" },
      data: { statut: "expired" },
    });

    const created = await tx.centerSubscription.create({
      data: {
        centerId,
        montant,
        dateDebut: start,
        dateFin,
        paidAt: now,
        duree,
        statut: "active",
        notes: input.notes?.trim() || null,
      },
    });

    await tx.center.update({
      where: { id: centerId },
      data: { active: true, subscriptionSuspendedAt: null },
    });

    await tx.systemLog.create({
      data: {
        action: "subscription_paid",
        entity: "Center",
        entityId: centerId,
        details: {
          centerName: center.name,
          montant,
          duree,
          dateDebut: start.toISOString(),
          dateFin: dateFin.toISOString(),
          paidAt: now.toISOString(),
          alreadyPaidThisMonth,
        },
      },
    });

    return created;
  });

  const daysRemaining = daysBetween(now, dateFin);
  const suffix = alreadyPaidThisMonth
    ? " Le centre avait déjà payé l'abonnement de ce mois : le paiement est enregistré comme renouvellement anticipé."
    : "";

  await notifySuperAdmins({
    centerId,
    type: "subscription_paid",
    titre: "Paiement d'abonnement enregistré",
    message:
      `${center.name} a payé l'abonnement (${durationLabel(duree)} — ${formatAmount(montant)} DT). ` +
      `Compteur démarré le ${formatDate(now)} : prochaine échéance le ${formatDate(dateFin)} (${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}).` +
      suffix,
  });

  return {
    subscription: {
      id: subscription.id,
      dateDebut: subscription.dateDebut,
      dateFin: subscription.dateFin,
      montant: Number(subscription.montant),
      paidAt: subscription.paidAt ?? now,
      duree: subscription.duree ?? duree,
    },
    centerName: center.name,
    daysRemaining,
    alreadyPaidThisMonth,
  };
}

export interface ReminderRunResult {
  checkedCenters: number;
  reminderJ3: number;
  dueToday: number;
  graceWarnings: number;
  suspendedCenters: number;
  suspendedNames: string[];
}

/**
 * Cycle quotidien :
 *  - J-3 : rappel « il reste 3 jours » ;
 *  - J   : rappel « à payer aujourd'hui » ;
 *  - J+1 à J+3 : rappel de grâce (gel à venir) ;
 *  - J+4 : gel automatique du centre (Center.active = false) + notification.
 *
 * Les notifications sont dédupliquées par jour pour ne pas spammer.
 */
export async function runSubscriptionReminders(options?: {
  centerIds?: string[];
}): Promise<ReminderRunResult> {
  const now = new Date();
  const result: ReminderRunResult = {
    checkedCenters: 0,
    reminderJ3: 0,
    dueToday: 0,
    graceWarnings: 0,
    suspendedCenters: 0,
    suspendedNames: [],
  };

  const centers = await prisma.center.findMany({
    where:
      options?.centerIds && options.centerIds.length > 0
        ? { id: { in: options.centerIds } }
        : undefined,
    include: {
      subscriptions: {
        where: { statut: "active" },
        orderBy: [{ dateFin: "desc" }],
        take: 1,
      },
    },
  });

  for (const center of centers) {
    const sub = center.subscriptions[0];
    if (!sub) continue;
    result.checkedCenters++;

    // Centre déjà gelé (auto ou manuellement) : plus de relances.
    if (!center.active) continue;

    const due = startOfUtcDay(sub.dateFin);
    const daysLeft = daysBetween(startOfUtcDay(now), due);
    const dueLabel = formatDate(sub.dateFin);
    const amount = formatAmount(sub.montant);

    if (daysLeft === REMINDER_DAYS_BEFORE) {
      const created = await notifySuperAdmins({
        centerId: center.id,
        type: "subscription_reminder_j3",
        titre: "Abonnement : 3 jours restants",
        message:
          `Il reste 3 jours pour encaisser l'abonnement de ${center.name}. ` +
          `Échéance : ${dueLabel}. Montant attendu : ${amount} DT.`,
        dedupeSameDay: true,
      });
      result.reminderJ3 += created;
      continue;
    }

    if (daysLeft === 0) {
      const created = await notifySuperAdmins({
        centerId: center.id,
        type: "subscription_due_today",
        titre: "Abonnement : à payer aujourd'hui",
        message:
          `L'abonnement de ${center.name} arrive à échéance aujourd'hui (${dueLabel}). ` +
          `Montant attendu : ${amount} DT. Enregistrez le paiement pour démarrer un nouveau compteur.`,
        dedupeSameDay: true,
      });
      result.dueToday += created;
      continue;
    }

    if (daysLeft < 0 && daysLeft >= -GRACE_DAYS) {
      const graceDay = -daysLeft;
      const remaining = GRACE_DAYS - graceDay;
      const created = await notifySuperAdmins({
        centerId: center.id,
        type: "subscription_grace_warning",
        titre: `Abonnement impayé : jour ${graceDay}/${GRACE_DAYS} de grâce`,
        message:
          `Abonnement impayé — ${center.name} : jour ${graceDay}/${GRACE_DAYS} de grâce. ` +
          (remaining > 0
            ? `Sans paiement, les comptes du centre seront gelés automatiquement dans ${remaining} jour${remaining > 1 ? "s" : ""}.`
            : "Sans paiement, les comptes du centre seront gelés automatiquement demain."),
        dedupeSameDay: true,
      });
      result.graceWarnings += created;
      continue;
    }

    if (daysLeft < -GRACE_DAYS) {
      await prisma.$transaction([
        prisma.center.update({
          where: { id: center.id },
          data: { active: false, subscriptionSuspendedAt: now },
        }),
        prisma.centerSubscription.update({
          where: { id: sub.id },
          data: { statut: "expired" },
        }),
        prisma.systemLog.create({
          data: {
            action: "subscription_auto_suspended",
            entity: "Center",
            entityId: center.id,
            details: {
              centerName: center.name,
              dueDate: sub.dateFin.toISOString(),
              daysOverdue: -daysLeft,
              montant: Number(sub.montant),
            },
          },
        }),
      ]);

      result.suspendedCenters++;
      result.suspendedNames.push(center.name);

      await notifySuperAdmins({
        centerId: center.id,
        type: "subscription_auto_suspended",
        titre: "Abonnement impayé : comptes gelés",
        message:
          `La période de grâce de ${GRACE_DAYS} jours est terminée pour ${center.name}. ` +
          `Ses comptes ont été gelés automatiquement. Enregistrez le paiement pour réactiver le centre.`,
      });
    }
  }

  logger.info("Cycle de rappels d'abonnement terminé", { ...result });
  return result;
}
