import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  backupRetention: "backupRetention",
  maintenanceMode: "maintenanceMode",
  openRegistration: "openRegistration",
  monitorEnabled: "monitorEnabled",
  monitorIntervalMinutes: "monitorIntervalMinutes",
  alertEmails: "alertEmails",
  alertWebhookUrl: "alertWebhookUrl",
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.backupRetention]: "14",
  [SETTING_KEYS.maintenanceMode]: "false",
  [SETTING_KEYS.openRegistration]: "true",
  [SETTING_KEYS.monitorEnabled]: "true",
  [SETTING_KEYS.monitorIntervalMinutes]: "5",
  [SETTING_KEYS.alertEmails]: "",
  [SETTING_KEYS.alertWebhookUrl]: "",
};

export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const merged = { ...SETTING_DEFAULTS };
  try {
    const rows = await prisma.platformSetting.findMany();
    for (const r of rows) merged[r.key] = r.value;
  } catch {
    // ignore DB errors, fall back to defaults
  }
  return merged;
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
}

export async function getBackupRetentionSetting(): Promise<number> {
  const value = await getSetting(SETTING_KEYS.backupRetention);
  const raw = parseInt(value || process.env.BACKUP_RETENTION || "14", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 14;
}

export async function isMaintenanceMode(): Promise<boolean> {
  return (await getSetting(SETTING_KEYS.maintenanceMode)) === "true";
}

export async function isRegistrationOpen(): Promise<boolean> {
  return (await getSetting(SETTING_KEYS.openRegistration)) !== "false";
}

export interface MonitorConfig {
  enabled: boolean;
  intervalMinutes: number;
  alertEmails: string[];
  alertWebhookUrl: string;
}

export async function getMonitorConfig(): Promise<MonitorConfig> {
  const [enabled, interval, emails, webhook] = await Promise.all([
    getSetting(SETTING_KEYS.monitorEnabled),
    getSetting(SETTING_KEYS.monitorIntervalMinutes),
    getSetting(SETTING_KEYS.alertEmails),
    getSetting(SETTING_KEYS.alertWebhookUrl),
  ]);

  let intervalMinutes = parseInt(interval || "5", 10);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1) intervalMinutes = 5;

  const emailList = (emails || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  return {
    enabled: enabled !== "false",
    intervalMinutes,
    alertEmails: emailList,
    alertWebhookUrl: (webhook || "").trim(),
  };
}
