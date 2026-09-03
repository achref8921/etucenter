import * as XLSX from "xlsx";

export const BACKUP_INFO_SHEET = "_INFO";

// Ordre des feuilles (une par entité) + mappage vers les clés du backup JSON.
export const BACKUP_SHEET_MAP: { sheet: string; key: string }[] = [
  { sheet: "Utilisateurs", key: "utilisateurs" },
  { sheet: "Groupes", key: "groupes" },
  { sheet: "Matieres", key: "matieres" },
  { sheet: "Seances", key: "seances" },
  { sheet: "Presences", key: "presences" },
  { sheet: "Paiements", key: "paiements" },
  { sheet: "Inscriptions", key: "inscriptions" },
  { sheet: "TauxBenefices", key: "tauxBenefices" },
  { sheet: "Notifications", key: "notifications" },
  { sheet: "TransactionsEleves", key: "studentTransactions" },
  { sheet: "TransactionsProfesseurs", key: "teacherTransactions" },
];

// Convertit les valeurs (Date -> ISO, Decimal -> number) pour un stockage Excel fiable.
function serializeRow(row: any): any {
  if (row instanceof Date) return row.toISOString();
  if (row === undefined) return null;
  if (Array.isArray(row)) return row.map((r) => serializeRow(r));
  if (row !== null && typeof row === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(row)) out[k] = serializeRow(row[k]);
    return out;
  }
  return row;
}

// Construit un classeur Excel à partir de la structure de backup (comme le JSON actuel).
export function buildBackupWorkbook(backup: {
  version: string;
  exportedAt: string;
  centre: string;
  centreSlug: string;
  centerId: string;
  data: Record<string, any[]>;
  stats: Record<string, number>;
}): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const infoRows: { Champ: string; Valeur: string | number }[] = [
    { Champ: "version", Valeur: backup.version },
    { Champ: "exportedAt", Valeur: backup.exportedAt },
    { Champ: "centre", Valeur: backup.centre },
    { Champ: "centreSlug", Valeur: backup.centreSlug },
    { Champ: "centerId", Valeur: backup.centerId },
  ];
  for (const [key, count] of Object.entries(backup.stats || {})) {
    infoRows.push({ Champ: `stats.${key}`, Valeur: count });
  }
  const infoSheet = XLSX.utils.json_to_sheet(infoRows);
  XLSX.utils.book_append_sheet(wb, infoSheet, BACKUP_INFO_SHEET);

  for (const { sheet, key } of BACKUP_SHEET_MAP) {
    const rows = backup.data[key] || [];
    const sheetData = rows.map((r) => serializeRow(r));
    const ws =
      sheetData.length > 0
        ? XLSX.utils.json_to_sheet(sheetData)
        : XLSX.utils.aoa_to_sheet([["Aucune donnée"]]);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }

  return wb;
}

export function backupWorkbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function backupBufferToWorkbook(buffer: ArrayBuffer | Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer" });
}

// Reconstruit la structure `data` + `stats` à partir d'un classeur Excel restauré.
export function workbookToBackupData(
  wb: XLSX.WorkBook
): { data: Record<string, any[]>; stats: Record<string, number> } {
  const data: Record<string, any[]> = {};
  const stats: Record<string, number> = {};

  for (const { sheet, key } of BACKUP_SHEET_MAP) {
    const ws = wb.Sheets[sheet];
    if (!ws) {
      data[key] = [];
      stats[key] = 0;
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
    const firstRow = rows[0];
    if (rows.length === 1 && firstRow && Object.values(firstRow).length === 1 && Object.values(firstRow)[0] === "Aucune donnée") {
      data[key] = [];
    } else {
      data[key] = rows;
    }
    stats[key] = data[key].length;
  }

  return { data, stats };
}

export function readBackupInfo(
  wb: XLSX.WorkBook
): { version: string; exportedAt: string; centre: string; centreSlug: string; stats: Record<string, number> } {
  const info: Record<string, string> = {};
  const ws = wb.Sheets[BACKUP_INFO_SHEET];
  if (ws) {
    const rows = XLSX.utils.sheet_to_json<{ Champ?: string; Valeur?: unknown }>(ws, { defval: null });
    for (const r of rows) {
      if (r.Champ) info[String(r.Champ)] = r.Valeur != null ? String(r.Valeur) : "";
    }
  }
  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(info)) {
    if (k.startsWith("stats.")) {
      stats[k.slice("stats.".length)] = Number(v) || 0;
    }
  }
  return {
    version: info.version || "1.0",
    exportedAt: info.exportedAt || "",
    centre: info.centre || "",
    centreSlug: info.centreSlug || "",
    stats,
  };
}
