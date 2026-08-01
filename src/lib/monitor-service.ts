import os from "node:os";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail, monitorAlertEmail } from "@/lib/email";
import { getMonitorConfig } from "@/lib/settings";

export type MonitorScope = "server" | "database" | "resources";
export type MonitorLevel = "ok" | "warning" | "error";

interface ScopeResult {
  type: MonitorScope;
  status: MonitorLevel;
  responseTimeMs: number | null;
  details: Record<string, unknown>;
}

let running = false;

// ─── Collecte des métriques ─────────────────────────────────────────────────

async function collectServerMetrics(): Promise<ScopeResult> {
  const t0 = Date.now();
  const details = {
    uptimeSec: Math.round(process.uptime()),
    platform: process.platform,
    nodeVersion: process.version,
    arch: process.arch,
    region: process.env.VERCEL_REGION || null,
    hostname: os.hostname(),
    checkedAt: new Date().toISOString(),
  };
  return { type: "server", status: "ok", responseTimeMs: Date.now() - t0, details };
}

async function collectDatabaseMetrics(): Promise<ScopeResult> {
  const t0 = Date.now();
  try {
    const rows = await prisma.$queryRaw<{ ok: number; now: Date; version: string }[]>`
      SELECT 1 AS ok, now() AS now, version() AS version
    `;
    const row = rows?.[0];
    return {
      type: "database",
      status: "ok",
      responseTimeMs: Date.now() - t0,
      details: {
        connected: true,
        version: row?.version ?? "unknown",
        dbTime: row?.now?.toISOString?.() ?? null,
      },
    };
  } catch (error) {
    return {
      type: "database",
      status: "error",
      responseTimeMs: Date.now() - t0,
      details: { connected: false, error: error instanceof Error ? error.message : String(error) },
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function collectResourceMetrics(): Promise<ScopeResult> {
  const t0 = Date.now();
  try {
    const mem = process.memoryUsage();
    const uptimeSec = process.uptime();
    const cpu = process.cpuUsage();
    const cpuSeconds = (cpu.user + cpu.system) / 1e6;
    const cpuPercent = uptimeSec > 0 ? round1((cpuSeconds / uptimeSec) * 100) : 0;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const hostMemUsedPercent = totalMem > 0 ? round1(((totalMem - freeMem) / totalMem) * 100) : 0;
    const loadavg = os.loadavg();

    const rssMB = round1(mem.rss / 1024 / 1024);
    const heapUsedMB = round1(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = round1(mem.heapTotal / 1024 / 1024);
    const externalMB = round1(mem.external / 1024 / 1024);

    let status: MonitorLevel = "ok";
    if (rssMB > 800 || hostMemUsedPercent > 95 || loadavg[0] > 8) status = "error";
    else if (rssMB > 500 || hostMemUsedPercent > 90 || loadavg[0] > 4) status = "warning";

    return {
      type: "resources",
      status,
      responseTimeMs: Date.now() - t0,
      details: {
        rssMB,
        heapUsedMB,
        heapTotalMB,
        externalMB,
        cpuPercent,
        loadavg: loadavg.map(round1),
        hostMemUsedPercent,
        totalMemMB: round1(totalMem / 1024 / 1024),
        freeMemMB: round1(freeMem / 1024 / 1024),
        uptimeSec: Math.round(uptimeSec),
      },
    };
  } catch (error) {
    return {
      type: "resources",
      status: "error",
      responseTimeMs: Date.now() - t0,
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

// ─── Journalisation des erreurs ─────────────────────────────────────────────

export async function logError(
  action: string,
  details: Record<string, unknown>,
  error?: unknown,
  userId?: string
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const safeAction = action.startsWith("error_") ? action : `error_${action}`;
  try {
    await prisma.systemLog.create({
      data: {
        action: safeAction,
        entity: (details.entity as string) ?? "System",
        entityId: (details.entityId as string) ?? undefined,
        details: { ...details, message },
        userId: userId ?? undefined,
      },
    });
  } catch (err) {
    console.error("[logError] failed to persist", err);
  }
  logger.error(`[${safeAction}] ${message}`, details);
}

// ─── Alertes (email, webhook, notification interne) ─────────────────────────

async function alertRecipients(): Promise<{ emails: string[]; superAdmins: { id: string; email: string; centerId: string }[] }> {
  const config = await getMonitorConfig();
  const superAdmins = await prisma.utilisateur.findMany({
    where: { role: "super_admin", actif: true, deletedAt: null },
    select: { id: true, email: true, centerId: true },
  });
  const emails = config.alertEmails.length > 0 ? config.alertEmails : superAdmins.map((u) => u.email);
  return { emails, superAdmins };
}

function cooldownMs(intervalMinutes: number): number {
  return Math.max(30, intervalMinutes * 6) * 60_000;
}

async function lastAlert(withinMs: number): Promise<{ id: string; createdAt: Date } | null> {
  return prisma.systemLog.findFirst({
    where: { action: "monitor_alert", createdAt: { gte: new Date(Date.now() - withinMs) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
}

async function notifyDown(failures: ScopeResult[], actorId?: string): Promise<void> {
  const config = await getMonitorConfig();
  const { emails, superAdmins } = await alertRecipients();

  const scopes = failures.map((f) => f.type).join(", ");
  const messages = failures.map((f) => `- ${f.type}: ${f.status} (${f.details.error ?? "ressource indisponible"})`).join("\n");

  const subject = `[GestExam] ⚠️ Incident détecté (${scopes})`;
  const mail = monitorAlertEmail(subject, failures);

  for (const email of emails) {
    if (email) await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  }

  if (config.alertWebhookUrl) {
    try {
      await fetch(config.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "monitor.down",
          scopes,
          message: `Incident détecté: ${scopes}`,
          failures,
          at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error("Échec d'envoi du webhook d'alerte", { error });
    }
  }

  for (const admin of superAdmins) {
    await prisma.notification.create({
      data: {
        centerId: admin.centerId,
        destinataireId: admin.id,
        titre: "Incident système détecté",
        message: `Le monitoring a détecté un problème : ${scopes}. ${messages}`,
        type: "monitor_alert",
      },
    }).catch(() => {});
  }

  await prisma.systemLog.create({
    data: {
      action: "monitor_alert",
      entity: "MonitorCheck",
      details: JSON.parse(JSON.stringify({ scopes, failures, recipients: emails.length, webhook: !!config.alertWebhookUrl })) as Prisma.InputJsonValue,
      userId: actorId ?? undefined,
    },
  });
}

async function notifyRecovered(actorId?: string): Promise<void> {
  const { emails } = await alertRecipients();
  const mail = monitorAlertEmail("[GestExam] ✅ Système rétabli", []);

  for (const email of emails) {
    if (email) await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  }

  await prisma.systemLog.create({
    data: { action: "monitor_recovered", entity: "MonitorCheck", userId: actorId ?? undefined },
  });
}

// ─── Exécution d'un cycle de contrôle ───────────────────────────────────────

export async function runMonitorCheck(opts: { actorId?: string; silent?: boolean } = {}): Promise<{
  results: ScopeResult[];
  alertSent: boolean;
  recoverySent: boolean;
}> {
  const { actorId, silent } = opts;
  if (running) {
    return { results: [], alertSent: false, recoverySent: false };
  }
  running = true;

  try {
    const config = await getMonitorConfig();
    if (!config.enabled) return { results: [], alertSent: false, recoverySent: false };

    const results = await Promise.all([collectServerMetrics(), collectDatabaseMetrics(), collectResourceMetrics()]);

    await prisma.monitorCheck.createMany({
      data: results.map((r) => ({
        type: r.type,
        status: r.status,
        responseTimeMs: r.responseTimeMs,
        details: r.details as Prisma.InputJsonValue,
      })),
    });

    const failures = results.filter((r) => r.status === "error");

    if (failures.length > 0) {
      for (const f of failures) {
        await prisma.systemLog.create({
          data: {
            action: "monitor_failed",
            entity: "MonitorCheck",
            details: { scope: f.type, status: f.status, error: f.details.error ?? null, responseTimeMs: f.responseTimeMs },
            userId: actorId ?? undefined,
          },
        });
      }

      const previous = await lastAlert(cooldownMs(config.intervalMinutes));
      if (!previous) {
        await notifyDown(failures, actorId);
        return { results, alertSent: true, recoverySent: false };
      }
      return { results, alertSent: false, recoverySent: false };
    }

    const recoveryWindow = 24 * 60 * 60 * 1000;
    const recentAlert = await lastAlert(recoveryWindow);
    if (recentAlert) {
      const recoveredAfter = await prisma.systemLog.findFirst({
        where: { action: "monitor_recovered", createdAt: { gte: recentAlert.createdAt } },
      });
      if (!recoveredAfter) {
        await notifyRecovered(actorId);
        return { results, alertSent: false, recoverySent: true };
      }
    }

    if (!silent) {
      await prisma.systemLog.create({
        data: { action: "monitor_check", entity: "MonitorCheck", details: JSON.parse(JSON.stringify({ results })) as Prisma.InputJsonValue, userId: actorId ?? undefined },
      });
    }

    return { results, alertSent: false, recoverySent: false };
  } catch (error) {
    await logError("monitor_run", { entity: "MonitorCheck" }, error, actorId);
    return { results: [], alertSent: false, recoverySent: false };
  } finally {
    running = false;
  }
}

// ─── Résumé pour la page Monitoring ─────────────────────────────────────────

export async function getMonitorSummary(historyLimit = 50) {
  const [latest, history, ok24h, total24h, errorsToday, checksToday, alerts24h] = await Promise.all([
    prisma.monitorCheck.findMany({ distinct: ["type"], orderBy: { checkedAt: "desc" }, take: 3 }),
    prisma.monitorCheck.findMany({ orderBy: { checkedAt: "desc" }, take: historyLimit }),
    prisma.monitorCheck.count({ where: { status: "ok", checkedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.monitorCheck.count({ where: { checkedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.systemLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, OR: [{ action: { startsWith: "error" } }, { action: "monitor_failed" }] } }),
    prisma.monitorCheck.count({ where: { checkedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.systemLog.count({ where: { action: "monitor_alert", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);

  const latestByType: Record<string, { status: MonitorLevel; checkedAt: Date; details: any; responseTimeMs: number | null } | null> = {
    server: null,
    database: null,
    resources: null,
  };
  for (const c of latest) {
    if (!latestByType[c.type]) latestByType[c.type] = c;
  }

  return {
    latest: latestByType,
    uptime24h: total24h > 0 ? Math.round((ok24h / total24h) * 100) : null,
    checksToday,
    errorsToday,
    alerts24h,
    history,
  };
}

export async function getRecentErrors(limit = 100) {
  return prisma.systemLog.findMany({
    where: {
      OR: [{ action: { startsWith: "error" } }, { action: "monitor_failed" }, { action: "monitor_alert" }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
