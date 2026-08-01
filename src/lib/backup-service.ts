import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getBackupRetentionSetting } from "@/lib/settings";
import { generateTemporaryPassword } from "@/lib/passwords";

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
export class BackupRestoreError extends Error {}

export async function getBackupRetention(): Promise<number> {
  return getBackupRetentionSetting();
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
    deletedAt: toDate(u.deletedAt),
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
    return {
      id: backup.id,
      version: backup.version,
      type: backup.type,
      status: backup.status,
      sizeBytes: backup.sizeBytes,
      createdAt: backup.createdAt,
      completedAt: backup.completedAt,
      checksum: backup.checksum ? backup.checksum.slice(0, 16) : null,
    };
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
  const keep = await getBackupRetention();
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
    retention: await getBackupRetention(),
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

const bump = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] || 0) + 1;
};

export async function restoreSystemBackup(opts: { id: string; actorId: string }): Promise<{
  version: number;
  type: BackupType;
  restoredAt: string;
  counts: Record<string, number>;
  merged: Record<string, number>;
  tempPasswords: { email: string; password: string }[];
}> {
  const { id, actorId } = opts;

  const backup = await prisma.systemBackup.findUnique({ where: { id } });
  if (!backup || !backup.data) throw new BackupRestoreError("Sauvegarde introuvable ou incomplète");
  if (backup.status === "en_cours") throw new BackupRestoreError("Cette sauvegarde n'est pas encore terminée");

  const verify = await verifySystemBackup(id);
  if (!verify.valid) {
    throw new BackupRestoreError("Vérification d'intégrité échouée : la sauvegarde est corrompue. Restauration annulée.");
  }

  const dump = JSON.parse(backup.data) as DbDump;

  const result = await prisma.$transaction(
    async (tx) => {
      const idMap: Record<string, string> = {};
      const counts: Record<string, number> = {};
      const merged: Record<string, number> = {};
      const tempPasswords: { email: string; password: string }[] = [];

      // Fusion : on conserve les données actuelles et on ajoute les éléments de la
      // sauvegarde qui n'existent pas déjà (clés naturelles), sans rien supprimer.
      for (const c of dump.tables.centers || []) {
        let live = await tx.center.findUnique({ where: { id: c.id } });
        if (!live) live = await tx.center.findFirst({ where: { code: c.code } });
        if (live) { idMap[c.id] = live.id; bump(merged, "centers"); continue; }
        const created = await tx.center.create({ data: buildCenter(c) });
        idMap[c.id] = created.id;
        bump(counts, "centers");
      }

      for (const u of dump.tables.utilisateurs || []) {
        const centerId = idMap[u.centerId];
        if (!centerId) continue;
        const existing = await tx.utilisateur.findUnique({ where: { email: u.email } });
        if (existing) { idMap[u.id] = existing.id; bump(merged, "utilisateurs"); continue; }

        let codeEleve = str(u.codeEleve);
        if (codeEleve) {
          const clash = await tx.utilisateur.findFirst({ where: { centerId, codeEleve } });
          if (clash) codeEleve = null;
        }
        let codeProf = str(u.codeProf);
        if (codeProf) {
          const clash = await tx.utilisateur.findFirst({ where: { centerId, codeProf } });
          if (clash) codeProf = null;
        }

        let motDePasse = str(u.motDePasse);
        let tempPassword: string | null = null;
        if (!motDePasse) {
          tempPassword = generateTemporaryPassword();
          motDePasse = await bcrypt.hash(tempPassword, 12);
        }

        const created = await tx.utilisateur.create({
          data: buildUtilisateur(u, {
            centerId,
            codeEleve,
            codeProf,
            motDePasse,
            emailVerificationToken: null,
            emailVerificationExpiry: null,
            passwordResetToken: null,
            passwordResetExpiry: null,
          }),
        });
        idMap[u.id] = created.id;
        bump(counts, "utilisateurs");
        if (tempPassword) tempPasswords.push({ email: u.email, password: tempPassword });
      }

      for (const m of dump.tables.matieres || []) {
        const centerId = idMap[m.centerId];
        if (!centerId) continue;
        const existing = await tx.matiere.findFirst({ where: { centerId, nom: m.nom } });
        if (existing) { idMap[m.id] = existing.id; bump(merged, "matieres"); continue; }
        const created = await tx.matiere.create({ data: { ...buildMatiere(m), centerId } });
        idMap[m.id] = created.id;
        bump(counts, "matieres");
      }

      for (const g of dump.tables.groupes || []) {
        const centerId = idMap[g.centerId];
        if (!centerId) continue;
        const existing = await tx.groupe.findFirst({ where: { centerId, nom: g.nom } });
        if (existing) { idMap[g.id] = existing.id; bump(merged, "groupes"); continue; }
        const created = await tx.groupe.create({
          data: {
            ...buildGroupe(g),
            centerId,
            profId: g.profId ? idMap[g.profId] || null : null,
            matiereId: g.matiereId ? idMap[g.matiereId] || null : null,
          },
        });
        idMap[g.id] = created.id;
        bump(counts, "groupes");
      }

      for (const s of dump.tables.seances || []) {
        const groupeId = idMap[s.groupeId];
        if (!groupeId) continue;
        const date = toDate(s.date) ?? new Date();
        const existing = await tx.seance.findFirst({ where: { groupeId, date } });
        if (existing) { idMap[s.id] = existing.id; bump(merged, "seances"); continue; }
        const created = await tx.seance.create({ data: { ...buildSeance(s), groupeId, date } });
        idMap[s.id] = created.id;
        bump(counts, "seances");
      }

      for (const i of dump.tables.inscriptions || []) {
        const eleveId = idMap[i.eleveId];
        const groupeId = idMap[i.groupeId];
        if (!eleveId || !groupeId) continue;
        const existing = await tx.inscription.findUnique({ where: { eleveId_groupeId: { eleveId, groupeId } } });
        if (existing) { bump(merged, "inscriptions"); continue; }
        await tx.inscription.create({ data: { ...buildInscription(i), eleveId, groupeId } });
        bump(counts, "inscriptions");
      }

      for (const p of dump.tables.presences || []) {
        const seanceId = idMap[p.seanceId];
        const eleveId = idMap[p.eleveId];
        if (!seanceId || !eleveId) continue;
        const existing = await tx.presence.findUnique({ where: { seanceId_eleveId: { seanceId, eleveId } } });
        if (existing) { bump(merged, "presences"); continue; }
        await tx.presence.create({
          data: {
            ...buildPresence(p),
            seanceId,
            eleveId,
            enregistrePar: p.enregistrePar ? idMap[p.enregistrePar] || null : null,
          },
        });
        bump(counts, "presences");
      }

      for (const p of dump.tables.paiements || []) {
        const eleveId = idMap[p.eleveId];
        const groupeId = idMap[p.groupeId];
        if (!eleveId || !groupeId) continue;
        const datePaiement = toDate(p.datePaiement) ?? new Date();
        const montant = Number(p.montant ?? 0);
        const existing = await tx.paiement.findFirst({ where: { eleveId, groupeId, montant, datePaiement } });
        if (existing) { bump(merged, "paiements"); continue; }
        await tx.paiement.create({ data: { ...buildPaiement(p), eleveId, groupeId, montant, datePaiement } });
        bump(counts, "paiements");
      }

      for (const t of dump.tables.tauxBenefices || []) {
        const profId = idMap[t.profId];
        if (!profId) continue;
        const existing = await tx.tauxBenefice.findUnique({ where: { profId } });
        if (existing) { bump(merged, "tauxBenefices"); continue; }
        await tx.tauxBenefice.create({ data: { ...buildTaux(t), profId } });
        bump(counts, "tauxBenefices");
      }

      for (const n of dump.tables.notifications || []) {
        const destinataireId = idMap[n.destinataireId];
        if (!destinataireId) continue;
        const centerId = idMap[n.centerId] || n.centerId;
        await tx.notification.create({ data: { ...buildNotification(n), centerId, destinataireId } });
        bump(counts, "notifications");
      }

      for (const s of dump.tables.centerSubscriptions || []) {
        const existing = await tx.centerSubscription.findUnique({ where: { id: s.id } });
        if (existing) continue;
        const centerId = idMap[s.centerId] || s.centerId;
        await tx.centerSubscription.create({ data: { ...buildSubscription(s), centerId } });
        bump(counts, "centerSubscriptions");
      }

      await tx.systemBackup.update({ where: { id }, data: { status: "restaure", restoredAt: new Date() } });

      return { counts, merged, tempPasswords };
    },
    { timeout: 120_000 }
  );

  await prisma.systemLog.create({
    data: {
      action: "backup_restored",
      entity: "SystemBackup",
      entityId: id,
      details: {
        version: backup.version,
        type: backup.type,
        counts: result.counts,
        merged: result.merged,
        tempPasswords: result.tempPasswords.length,
      },
      userId: actorId,
    },
  });

  logger.info("Sauvegarde restaurée (fusion)", { version: backup.version, id, counts: result.counts, merged: result.merged });

  return {
    version: backup.version,
    type: backup.type,
    restoredAt: new Date().toISOString(),
    counts: result.counts,
    merged: result.merged,
    tempPasswords: result.tempPasswords,
  };
}
