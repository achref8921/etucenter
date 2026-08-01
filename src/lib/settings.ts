import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  backupRetention: "backupRetention",
  maintenanceMode: "maintenanceMode",
  openRegistration: "openRegistration",
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.backupRetention]: "14",
  [SETTING_KEYS.maintenanceMode]: "false",
  [SETTING_KEYS.openRegistration]: "true",
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
