import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const BACKUP_SCHEMA_VERSION = "1.0";
export const BACKUP_KIND = "educenter-db-backup";

export type BackupType = "automatique" | "manuel";
export type BackupStatus = "en_cours" | "ok" | "echec" | "restaure";

interface DbDump {
  kind: string;
  schemaVersion: string;
  createdAt: string;
  type: BackupType;
  version: number;
  counts: Record<string, number>;
  tables: Record<string, any[]>;
}

export class BackupBusyError extends Error {}

export function getBackupRetention(): number {
  const raw = parseInt(process.env.BACKUP_RETENTION || "14", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 14;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ─── Snapshot (lecture cohérente sans bloquer les écritures) ─────────────────

async function snapshotTables(tx: Prisma.TransactionClient): Promise<{ tables: DbDump["tables"]; counts: Record<string, number> }> {
  const [centers, utilisateurs, matieres, groupes, inscriptions, seances, presences, paiements, tauxBenefices, notifications, centerSubscriptions] =
    await Promise.all([
      tx.center.findMany(),
      tx.utilisateur.findMany(),
      tx.matiere.findMany(),
      tx.groupe.findMany(),
      tx.inscription.findMany(),
      tx.seance.findMany(),
      tx.presence.findMany(),
      tx.paiement.findMany(),
      tx.tauxBenefice.findMany(),
      tx.notification.findMany(),
      tx.centerSubscription.findMany(),
    ]);

  const toNumber = (rows: any[], field: string) => rows.map((r) => ({ ...r, [field]: Number(r[field]) }));

  const tables: DbDump["tables"] = {
    centers,
    utilisateurs,
    matieres,
    groupes: toNumber(groupes, "prixParSeance"),
    inscriptions,
    seances,
    presences,
    paiements: toNumber(paiements, "montant"),
    tauxBenefices: toNumber(tauxBenefices, "tauxPourcentage"),
    notifications,
    centerSubscriptions: toNumber(centerSubscriptions, "montant"),
  };

  const counts: Record<string, number> = {};
  for (const [key, rows] of Object.entries(tables)) counts[key] = rows.length;

  return { tables, counts };
}

// ─── Validation / intégrité ───────────────────────────────────────────────────

function validateDump(dump: any): string[] {
  const errors: string[] = [];
  if (!dump || typeof dump !== "object") return ["Structure de la sauvegarde invalide"];
  if (dump.kind !== BACKUP_KIND) errors.push("Type de fichier inconnu");
  if (typeof dump.schemaVersion !== "string") errors.push("Version du schéma manquante");
  if (typeof dump.createdAt !== "string") errors.push("Date de création manquante");
  if (!dump.tables || typeof dump.tables !== "object") {
    errors.push("Données de la sauvegarde manquantes");
    return errors;
  }
  for (const [key, expected] of Object.entries(dump.counts || {})) {
    const actual = Array.isArray(dump.tables[key]) ? dump.tables[key].length : -1;
    if (actual !== expected) errors.push(`Table ${key}: attendu ${expected} lignes, trouvé ${actual}`);
  }
  return errors;
}

export async function verifySystemBackup(id: string): Promise<{
  valid: boolean;
  checksumOk: boolean;
  structuralErrors: string[];
  counts: Record<string, number>;
  sizeBytes: number;
  checksum: string | null;
}> {
  const row = await prisma.systemBackup.findUnique({ where: { id } });
  if (!row || !row.data) {
    return { valid: false, checksumOk: false, structuralErrors: ["Sauvegarde introuvable ou incomplète"], counts: {}, sizeBytes: 0, checksum: null };
  }

  const computed = sha256(row.data);
  const checksumOk = row.checksum === computed;

  let dump: any = null;
  let structuralErrors: string[] = [];
  let counts: Record<string, number> = {};
  try {
    dump = JSON.parse(row.data);
    structuralErrors = validateDump(dump);
    counts = dump.counts || {};
  } catch {
    structuralErrors = ["Contenu JSON illisible (sauvegarde corrompue)"];
  }

  return {
    valid: checksumOk && structuralErrors.length === 0,
    checksumOk,
    structuralErrors,
    counts,
    sizeBytes: row.sizeBytes ?? Buffer.byteLength(row.data, "utf8"),
    checksum: row.checksum,
  };
}

// ─── Builders de restauration (mappage explicite + conversion des dates) ──────

const toDate = (v: any) => (v ? new Date(v) : null);
const str = (v: any) => (v === undefined ? null : v);

function buildCenter(c: any) {
  return {
    id: c.id, name: c.name, slug: c.slug, code: c.code,
    logo: str(c.logo), phone: str(c.phone), address: str(c.address),
    active: c.active ?? true,
    createdAt: toDate(c.createdAt) ?? new Date(),
    updatedAt: toDate(c.updatedAt) ?? new Date(),
  };
}

function buildUtilisateur(u: any, overrides: Record<string, any> = {}) {
  return {
    id: u.id, centerId: u.centerId,
    nom: u.nom, prenom: u.prenom, email: u.email,
    motDePasse: str(u.motDePasse), telephone: str(u.telephone), role: u.role,
    image: str(u.image), dateNaissance: toDate(u.dateNaissance),
    actif: u.actif ?? false, codeEleve: str(u.codeEleve), codeProf: str(u.codeProf),
    niveau: str(u.niveau), classe: str(u.classe), filiere: str(u.filiere),
    provider: u.provider ?? "credentials", providerId: str(u.providerId),
    emailVerified: toDate(u.emailVerified),
    emailVerificationToken: str(u.emailVerificationToken),
    emailVerificationExpiry: toDate(u.emailVerificationExpiry),
    passwordResetToken: str(u.passwordResetToken),
    passwordResetExpiry: toDate(u.passwordResetExpiry),
    createdAt: toDate(u.createdAt) ?? new Date(),
    updatedAt: toDate(u.updatedAt) ?? new Date(),
    ...overrides,
  };
}

function buildMatiere(m: any) {
  return { id: m.id, centerId: m.centerId, nom: m.nom, description: str(m.description), createdAt: toDate(m.createdAt) ?? new Date() };
}

function buildGroupe(g: any) {
  return {
    id: g.id, centerId: g.centerId, nom: g.nom, description: str(g.description),
    profId: str(g.profId), matiereId: str(g.matiereId),
    prixParSeance: Number(g.prixParSeance ?? 0), capaciteMax: str(g.capaciteMax),
    createdAt: toDate(g.createdAt) ?? new Date(), updatedAt: toDate(g.updatedAt) ?? new Date(),
  };
}

function buildInscription(i: any) {
  return { id: i.id, eleveId: i.eleveId, groupeId: i.groupeId, dateInscription: toDate(i.dateInscription) ?? new Date(), statut: i.statut };
}

function buildSeance(s: any) {
  return {
    id: s.id, groupeId: s.groupeId, date: toDate(s.date) ?? new Date(),
    heureDebut: toDate(s.heureDebut), heureFin: toDate(s.heureFin),
    statut: s.statut, notes: str(s.notes), createdAt: toDate(s.createdAt) ?? new Date(),
  };
}

function buildPresence(p: any) {
  return {
    id: p.id, seanceId: p.seanceId, eleveId: p.eleveId, statut: p.statut,
    enregistrePar: str(p.enregistrePar),
    dateCreation: toDate(p.dateCreation) ?? new Date(), dateModification: toDate(p.dateModification) ?? new Date(),
  };
}

function buildPaiement(p: any) {
  return {
    id: p.id, eleveId: p.eleveId, groupeId: p.groupeId, montant: Number(p.montant ?? 0),
    datePaiement: toDate(p.datePaiement) ?? new Date(), methodePaiement: p.methodePaiement,
    reference: str(p.reference), notes: str(p.notes), createdAt: toDate(p.createdAt) ?? new Date(),
  };
}

function buildTaux(t: any) {
  return {
    id: t.id, profId: t.profId, tauxPourcentage: Number(t.tauxPourcentage ?? 0),
    createdAt: toDate(t.createdAt) ?? new Date(), updatedAt: toDate(t.updatedAt) ?? new Date(),
  };
}

function buildNotification(n: any) {
  return {
    id: n.id, centerId: n.centerId, destinataireId: n.destinataireId,
    titre: n.titre, message: n.message, type: n.type, lu: !!n.lu,
    createdAt: toDate(n.createdAt) ?? new Date(),
  };
}

function buildSubscription(s: any) {
  return {
    id: s.id, centerId: s.centerId, montant: Number(s.montant ?? 0),
    dateDebut: toDate(s.dateDebut) ?? new Date(), dateFin: toDate(s.dateFin) ?? new Date(),
    statut: s.statut, notes: str(s.notes),
    createdAt: toDate(s.createdAt) ?? new Date(), updatedAt: toDate(s.updatedAt) ?? new Date(),
  };
}

// ─── Création d'une sauvegarde ────────────────────────────────────────────────

export async function createSystemBackup(opts: { type: BackupType; createdBy?: string | null }): Promise<any> {
  const { type, createdBy = null } = opts;

  const running = await prisma.systemBackup.findFirst({ where: { status: "en_cours" } });
  if (running) throw new BackupBusyError();

  const lastVersion = await prisma.systemBackup.aggregate({ _max: { version: true } });
  const version = (lastVersion._max.version ?? 0) + 1;

  let backup = await prisma.systemBackup.create({
    data: { version, type, status: "en_cours", createdBy },
  });

  try {
    const { tables, counts } = await prisma.$transaction(
      (tx) => snapshotTables(tx),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 }
    );

    const dump: DbDump = {
      kind: BACKUP_KIND,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      type,
      version,
      counts,
      tables,
    };

    const json = JSON.stringify(dump);
    const checksum = sha256(json);
    const sizeBytes = Buffer.byteLength(json, "utf8");

    backup = await prisma.systemBackup.update({
      where: { id: backup.id },
      data: { status: "ok", checksum, sizeBytes, rowCounts: counts, data: json, completedAt: new Date(), error: null },
    });

    await prisma.systemLog.create({
      data: {
        action: "backup_created",
        entity: "SystemBackup",
        entityId: backup.id,
        details: { version, type, sizeBytes, counts, checksum: checksum.slice(0, 12) + "…" },
        userId: createdBy ?? undefined,
      },
    });

    await pruneBackups(createdBy);

    logger.info("Sauvegarde créée", { version, type, sizeBytes });
    return backup;
  } catch (error: any) {
    await prisma.systemBackup
      .update({
        where: { id: backup.id },
        data: { status: "echec", error: error?.message ?? "Erreur inconnue", completedAt: new Date() },
      })
      .catch(() => {});
    await prisma.systemLog
      .create({
        data: {
          action: "backup_failed",
          entity: "SystemBackup",
          entityId: backup.id,
          details: { version, type, error: error?.message ?? "Erreur inconnue" },
          userId: createdBy ?? undefined,
        },
      })
      .catch(() => {});
    throw error;
  }
}

// ─── Rétention (conserver les N plus récentes) ────────────────────────────────

async function pruneBackups(logActor?: string | null): Promise<void> {
  const keep = getBackupRetention();
  const all = await prisma.systemBackup.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, status: true },
  });

  const toDelete = all.slice(keep).map((r) => r.id);

  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const staleFailed = all
    .filter((r) => r.status === "echec" && r.createdAt < staleCutoff)
    .map((r) => r.id);

  const ids = [...new Set([...toDelete, ...staleFailed])];
  if (ids.length === 0) return;

  await prisma.systemBackup.deleteMany({ where: { id: { in: ids } } });
  await prisma.systemLog.create({
    data: {
      action: "backup_pruned",
      entity: "SystemBackup",
      details: { deleted: ids.length, retention: keep, staleFailed: staleFailed.length },
      userId: logActor ?? undefined,
    },
  });
  logger.info("Sauvegardes purgées (rétention)", { deleted: ids.length, retention: keep });
}

// ─── Listage / statistiques ───────────────────────────────────────────────────

export async function listSystemBackups() {
  return prisma.systemBackup.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true, version: true, type: true, status: true, checksum: true,
      sizeBytes: true, rowCounts: true, createdBy: true, error: true,
      createdAt: true, completedAt: true, restoredAt: true,
    },
  });
}

export async function getBackupStats() {
  const [total, ok, echec, enCours, last, sizeAgg] = await Promise.all([
    prisma.systemBackup.count(),
    prisma.systemBackup.count({ where: { status: "ok" } }),
    prisma.systemBackup.count({ where: { status: "echec" } }),
    prisma.systemBackup.count({ where: { status: "en_cours" } }),
    prisma.systemBackup.findFirst({ where: { status: "ok" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, version: true, sizeBytes: true } }),
    prisma.systemBackup.aggregate({ _sum: { sizeBytes: true } }),
  ]);

  return {
    total,
    ok,
    echec,
    enCours,
    last,
    totalSizeBytes: sizeAgg._sum.sizeBytes ?? 0,
    retention: getBackupRetention(),
  };
}

// ─── Suppression ──────────────────────────────────────────────────────────────

export async function deleteSystemBackup(id: string, actorId?: string | null): Promise<boolean> {
  const row = await prisma.systemBackup.findUnique({ where: { id } });
  if (!row) return false;
  await prisma.systemBackup.delete({ where: { id } });
  await prisma.systemLog.create({
    data: {
      action: "backup_deleted",
      entity: "SystemBackup",
      entityId: id,
      details: { version: row.version, type: row.type, status: row.status },
      userId: actorId ?? undefined,
    },
  });
  return true;
}

// ─── Restauration ─────────────────────────────────────────────────────────────

async function preserveActorLogin(tx: Prisma.TransactionClient, dump: DbDump, actorUser: any): Promise<{ needed: boolean; reason: string }> {
  if (!actorUser) return { needed: false, reason: "compte_introuvable" };

  const stillExists = dump.tables.utilisateurs?.some((u: any) => u.email === actorUser.email);
  if (stillExists) return { needed: false, reason: "present_dans_la_sauvegarde" };

  const existingCodes = new Set((dump.tables.centers || []).map((c: any) => c.code));
  const existingSlugs = new Set((dump.tables.centers || []).map((c: any) => c.slug));

  const generateCode = () => {
    let code = "";
    do {
      code = Array.from({ length: 6 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("");
    } while (existingCodes.has(code));
    return code;
  };

  let centerId = actorUser.centerId;
  const centerExists = dump.tables.centers?.some((c: any) => c.id === centerId);

  if (!centerExists) {
    const fallback = dump.tables.centers?.[0];
    if (fallback) {
      centerId = fallback.id;
    } else {
      const slug = `centre-restaure-${Date.now()}`;
      const code = generateCode();
      await tx.center.create({
        data: { id: actorUser.centerId, name: "Centre Restauré", slug, code, logo: null, phone: null, address: null, active: true },
      });
      existingSlugs.add(slug);
      existingCodes.add(code);
    }
  }

  await tx.utilisateur.create({
    data: buildUtilisateur(actorUser, { centerId, actif: true }),
  });

  return { needed: true, reason: "compte_admin_preserve" };
}

export async function restoreSystemBackup(opts: { id: string; actorId: string }): Promise<{
  version: number;
  type: BackupType;
  restoredAt: string;
  counts: Record<string, number>;
  preserved: { needed: boolean; reason: string };
}> {
  const { id, actorId } = opts;

  const backup = await prisma.systemBackup.findUnique({ where: { id } });
  if (!backup || !backup.data) throw new Error("Sauvegarde introuvable ou incomplète");
  if (backup.status === "en_cours") throw new Error("Cette sauvegarde n'est pas encore terminée");

  const verify = await verifySystemBackup(id);
  if (!verify.valid) {
    throw new Error("Vérification d'intégrité échouée : la sauvegarde est corrompue. Restauration annulée.");
  }

  const dump = JSON.parse(backup.data) as DbDump;
  const actorUser = await prisma.utilisateur.findUnique({ where: { id: actorId } });

  const result = await prisma.$transaction(
    async (tx) => {
      // Suppression en ordre inverse des dépendances (enfants → parents)
      await tx.presence.deleteMany({});
      await tx.paiement.deleteMany({});
      await tx.seance.deleteMany({});
      await tx.inscription.deleteMany({});
      await tx.tauxBenefice.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.centerSubscription.deleteMany({});
      await tx.groupe.deleteMany({});
      await tx.matiere.deleteMany({});
      await tx.utilisateur.deleteMany({});
      await tx.center.deleteMany({});

      // Réinsertion en ordre de dépendance (parents → enfants), IDs conservés
      for (const c of dump.tables.centers || []) await tx.center.create({ data: buildCenter(c) });
      for (const u of dump.tables.utilisateurs || []) await tx.utilisateur.create({ data: buildUtilisateur(u) });
      for (const m of dump.tables.matieres || []) await tx.matiere.create({ data: buildMatiere(m) });
      for (const g of dump.tables.groupes || []) await tx.groupe.create({ data: buildGroupe(g) });
      for (const i of dump.tables.inscriptions || []) await tx.inscription.create({ data: buildInscription(i) });
      for (const s of dump.tables.seances || []) await tx.seance.create({ data: buildSeance(s) });
      for (const p of dump.tables.presences || []) await tx.presence.create({ data: buildPresence(p) });
      for (const p of dump.tables.paiements || []) await tx.paiement.create({ data: buildPaiement(p) });
      for (const t of dump.tables.tauxBenefices || []) await tx.tauxBenefice.create({ data: buildTaux(t) });
      for (const n of dump.tables.notifications || []) await tx.notification.create({ data: buildNotification(n) });
      for (const s of dump.tables.centerSubscriptions || []) await tx.centerSubscription.create({ data: buildSubscription(s) });

      const preserved = await preserveActorLogin(tx, dump, actorUser);

      await tx.systemBackup.update({ where: { id }, data: { status: "restaure", restoredAt: new Date() } });

      return { counts: dump.counts || {}, preserved };
    },
    { timeout: 120_000 }
  );

  await prisma.systemLog.create({
    data: {
      action: "backup_restored",
      entity: "SystemBackup",
      entityId: id,
      details: { version: backup.version, type: backup.type, counts: result.counts, preserved: result.preserved },
      userId: actorId,
    },
  });

  logger.info("Sauvegarde restaurée", { version: backup.version, id });

  return { version: backup.version, type: backup.type, restoredAt: new Date().toISOString(), counts: result.counts, preserved: result.preserved };
}
