import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface MaintenanceResult {
  logsPurged: number;
  notificationsPurged: number;
  presencesArchived: number;
  seancesArchived: number;
  paiementsArchived: number;
  dataRetentionMonths: number;
}

function getEnvInt(name: string, fallback: number): number {
  const raw = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

function getDataRetentionMonths(): number {
  return getEnvInt("DATA_RETENTION_MONTHS", 0);
}

const ARCHIVE_TABLES: { archive: string; source: string }[] = [
  { archive: "archive_system_logs", source: "system_logs" },
  { archive: "archive_notifications", source: "notifications" },
  { archive: "archive_presences", source: "presences" },
  { archive: "archive_seances", source: "seances" },
  { archive: "archive_paiements", source: "paiements" },
];

async function ensureArchiveTables(): Promise<void> {
  for (const t of ARCHIVE_TABLES) {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS ${t.archive} (LIKE ${t.source} INCLUDING ALL)`
    );
  }
}

async function moveOldRows(
  table: string,
  archiveTable: string,
  whereSql: string,
  params: unknown[],
  alias: string = table
): Promise<number> {
  const sql = `WITH del AS (DELETE FROM ${table} ${whereSql} RETURNING ${alias}.*) INSERT INTO ${archiveTable} SELECT * FROM del`;
  return prisma.$executeRawUnsafe(sql, ...params);
}

export async function runDatabaseMaintenance(): Promise<MaintenanceResult> {
  const logRetentionDays = getEnvInt("LOG_RETENTION_DAYS", 90);
  const notifRetentionDays = getEnvInt("NOTIFICATION_RETENTION_DAYS", 180);
  const dataRetentionMonths = getDataRetentionMonths();

  await ensureArchiveTables();

  const logCutoff = new Date(Date.now() - logRetentionDays * 24 * 60 * 60 * 1000);
  const notifCutoff = new Date(Date.now() - notifRetentionDays * 24 * 60 * 60 * 1000);

  const logsPurged = await moveOldRows(
    "system_logs",
    "archive_system_logs",
    "WHERE created_at < $1::timestamptz",
    [logCutoff]
  );

  const notificationsPurged = await moveOldRows(
    "notifications",
    "archive_notifications",
    "WHERE lu = true AND created_at < $1::timestamptz",
    [notifCutoff]
  );

  let presencesArchived = 0;
  let seancesArchived = 0;
  let paiementsArchived = 0;

  if (dataRetentionMonths > 0) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - dataRetentionMonths);
    cutoff.setHours(0, 0, 0, 0);

    presencesArchived = await moveOldRows(
      "presences",
      "archive_presences",
      "pr USING seances s WHERE pr.seance_id = s.id AND s.date < $1::date",
      [cutoff],
      "pr"
    );
    seancesArchived = await moveOldRows(
      "seances",
      "archive_seances",
      "WHERE date < $1::date",
      [cutoff]
    );
    paiementsArchived = await moveOldRows(
      "paiements",
      "archive_paiements",
      "WHERE date_paiement < $1::timestamptz",
      [cutoff]
    );
  }

  const result: MaintenanceResult = {
    logsPurged,
    notificationsPurged,
    presencesArchived,
    seancesArchived,
    paiementsArchived,
    dataRetentionMonths,
  };

  await prisma.systemLog.create({
    data: {
      action: "maintenance_archive",
      entity: "Database",
      details: {
        logsPurged,
        notificationsPurged,
        presencesArchived,
        seancesArchived,
        paiementsArchived,
        logRetentionDays,
        notifRetentionDays,
        dataRetentionMonths,
      },
    },
  });

  logger.info("Maintenance de la base de données terminée", { ...result });

  return result;
}
