import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateTemporaryPassword } from "@/lib/passwords";
import { headDocument } from "@/lib/seance-documents-storage";

export const BACKUP_KIND = "educenter-center-backup";
export const BACKUP_SCHEMA_VERSION = "1.0";

type Tx = Prisma.TransactionClient;

function str(v: any): string | null {
  return v === undefined || v === null ? null : String(v);
}
function date(v: any): Date | null {
  if (v === undefined || v === null) return null;
  return new Date(v);
}
function toIso(v: any): string | null {
  return v ? new Date(v).toISOString() : null;
}
function num(v: any): number | null {
  if (v === undefined || v === null) return null;
  return Number(v);
}

export interface CenterBackupDump {
  kind: string;
  schemaVersion: string;
  createdAt: string;
  centerId: string;
  centre: string;
  centreSlug: string;
  counts: Record<string, number>;
  data: {
    utilisateurs: any[];
    matieres: any[];
    groupes: any[];
    inscriptions: any[];
    seances: any[];
    presences: any[];
    // Métadonnées des supports de séance. Les FICHIERS eux-mêmes vivent dans
    // Vercel Blob et ne sont pas contenus dans ce JSON : à la restauration,
    // chaque ligne n'est réimportée que si le fichier existe réellement dans le
    // store cible (sinon elle est ignorée et comptabilisée).
    seanceDocuments: any[];
    paiements: any[];
    tauxBenefices: any[];
    notifications: any[];
    studentTransactions: any[];
    teacherTransactions: any[];
    teacherDebts?: any[];
    pushSubscriptions: any[];
  };
}

// ─── Gathering (export) ───────────────────────────────────────────────────────

export async function gatherCenterBackup(
  prisma: PrismaClient,
  centerId: string,
  centreName: string,
  centreSlug: string
): Promise<CenterBackupDump> {
  const [
    utilisateurs,
    matieres,
    groupes,
    inscriptions,
    seances,
    presences,
    seanceDocuments,
    paiements,
    tauxBenefices,
    notifications,
    studentTransactions,
    teacherTransactions,
    teacherDebts,
    pushSubscriptions,
  ] = await Promise.all([
    prisma.utilisateur.findMany({ where: { centerId } }),
    prisma.matiere.findMany({ where: { centerId } }),
    prisma.groupe.findMany({ where: { centerId } }),
    prisma.inscription.findMany({ where: { groupe: { centerId } } }),
    prisma.seance.findMany({ where: { groupe: { centerId } } }),
    prisma.presence.findMany({ where: { seance: { groupe: { centerId } } } }),
    prisma.seanceDocument.findMany({ where: { centerId } }),
    prisma.paiement.findMany({ where: { groupe: { centerId } } }),
    prisma.tauxBenefice.findMany({ where: { prof: { centerId } } }),
    prisma.notification.findMany({ where: { centerId } }),
    prisma.studentTransaction.findMany({ where: { centerId } }),
    prisma.teacherTransaction.findMany({ where: { centerId } }),
    prisma.teacherCenterDebt.findMany({ where: { centerId } }),
    prisma.pushSubscription.findMany({ where: { centerId } }),
  ]);

  const uRows = utilisateurs.map((u) => ({
    id: u.id, centerId: u.centerId, nom: u.nom, prenom: u.prenom, email: u.email,
    motDePasse: str(u.motDePasse), telephone: str(u.telephone), role: u.role,
    image: str(u.image), dateNaissance: toIso(u.dateNaissance), actif: u.actif,
    peutGererEleves: u.peutGererEleves, peutEncaisserReverse: u.peutEncaisserReverse, codeEleve: str(u.codeEleve), codeProf: str(u.codeProf),
    niveau: str(u.niveau), classe: str(u.classe), filiere: str(u.filiere),
    deletedAt: toIso(u.deletedAt), provider: u.provider ?? "credentials",
    createdAt: toIso(u.createdAt), updatedAt: toIso(u.updatedAt),
  }));

  const data = {
    utilisateurs: uRows,
    matieres: matieres.map((m) => ({
      id: m.id, centerId: m.centerId, nom: m.nom, description: str(m.description), createdAt: toIso(m.createdAt),
    })),
    groupes: groupes.map((g) => ({
      id: g.id, centerId: g.centerId, nom: g.nom, description: str(g.description),
      profId: str(g.profId), matiereId: str(g.matiereId),
      prixParSeance: num(g.prixParSeance), forfaitMontant: num(g.forfaitMontant),
      forfaitSeances: num(g.forfaitSeances), capaciteMax: num(g.capaciteMax),
      createdAt: toIso(g.createdAt), updatedAt: toIso(g.updatedAt),
    })),
    inscriptions: inscriptions.map((i) => ({
      id: i.id, eleveId: i.eleveId, groupeId: i.groupeId,
      dateInscription: toIso(i.dateInscription), statut: i.statut,
      forfaitMontant: i.forfaitMontant != null ? num(i.forfaitMontant) : null,
      forfaitSeances: i.forfaitSeances != null ? i.forfaitSeances : null,
      forfaitSetAt: i.forfaitSetAt ? toIso(i.forfaitSetAt) : null,
    })),
    seances: seances.map((s) => ({
      id: s.id, groupeId: s.groupeId, date: toIso(s.date),
      heureDebut: toIso(s.heureDebut), heureFin: toIso(s.heureFin),
      statut: s.statut, notes: str(s.notes), prixParSeance: num(s.prixParSeance),
      createdAt: toIso(s.createdAt),
    })),
    presences: presences.map((p) => ({
      id: p.id, seanceId: p.seanceId, eleveId: p.eleveId,       statut: p.statut,
      enregistrePar: str(p.enregistrePar), dateCreation: toIso(p.dateCreation), dateModification: toIso(p.dateModification),
    })),
    seanceDocuments: seanceDocuments.map((d) => ({
      id: d.id, centerId: d.centerId, seanceId: d.seanceId,
      pathname: d.pathname, fileName: d.fileName, mimeType: d.mimeType,
      sizeBytes: d.sizeBytes, description: str(d.description),
      uploadedById: str(d.uploadedById), statut: d.statut,
      verifiedAt: toIso(d.verifiedAt), createdAt: toIso(d.createdAt),
    })),
    paiements: paiements.map((p) => ({
      id: p.id, eleveId: p.eleveId, groupeId: p.groupeId, montant: num(p.montant),
      datePaiement: toIso(p.datePaiement), methodePaiement: p.methodePaiement,
      reference: str(p.reference), notes: str(p.notes), createdAt: toIso(p.createdAt),
    })),
    tauxBenefices: tauxBenefices.map((t) => ({
      id: t.id, profId: t.profId, tauxPourcentage: num(t.tauxPourcentage),
      createdAt: toIso(t.createdAt), updatedAt: toIso(t.updatedAt),
    })),
    notifications: notifications.map((n) => ({
      id: n.id, centerId: n.centerId, destinataireId: n.destinataireId,
      type: n.type, titre: n.titre, message: n.message, lu: n.lu, createdAt: toIso(n.createdAt),
    })),
    studentTransactions: studentTransactions.map((t) => ({
      id: t.id, centerId: t.centerId, eleveId: t.eleveId, type: t.type, status: t.status,
      amount: num(t.amount), signedAmount: num(t.signedAmount), description: t.description,
      paymentMethod: str(t.paymentMethod), date: toIso(t.date), time: toIso(t.time),
      receiptNumber: str(t.receiptNumber), reference: str(t.reference),
      attendanceId: str(t.attendanceId), idempotencyKey: str(t.idempotencyKey),
      notes: str(t.notes), createdBy: str(t.createdBy), reversalOfId: str(t.reversalOfId),
      reversedById: str(t.reversedById), reversedAt: toIso(t.reversedAt), createdAt: toIso(t.createdAt),
    })),
    teacherTransactions: teacherTransactions.map((t) => ({
      id: t.id, centerId: t.centerId, teacherId: t.teacherId, type: t.type, status: t.status,
      mode: t.mode, amount: num(t.amount), signedAmount: num(t.signedAmount), description: t.description,
      paymentMethod: str(t.paymentMethod), date: toIso(t.date), time: toIso(t.time),
      receiptNumber: str(t.receiptNumber), reference: str(t.reference), notes: str(t.notes),
      createdBy: str(t.createdBy), reversalOfId: str(t.reversalOfId), reversedById: str(t.reversedById),
      reversedAt: toIso(t.reversedAt), createdAt: toIso(t.createdAt),
      amountReceived: num(t.amountReceived), centerFee: num(t.centerFee), netAmount: num(t.netAmount),
      collectionPct: num(t.collectionPct), studentId: str(t.studentId), seanceId: str(t.seanceId),
      direction: str(t.direction), linkedDebtId: str(t.linkedDebtId),
    })),
    teacherDebts: teacherDebts.map((d) => ({
      id: d.id, centerId: d.centerId, teacherId: d.teacherId, studentId: str(d.studentId), seanceId: str(d.seanceId),
      amountDue: num(d.amountDue), amountPaid: num(d.amountPaid), balance: num(d.balance), status: d.status,
      reverseTxId: str(d.reverseTxId), settlementTxId: str(d.settlementTxId), notes: str(d.notes),
      createdAt: toIso(d.createdAt), updatedAt: toIso(d.updatedAt), settledAt: toIso(d.settledAt),
    })),
    pushSubscriptions: pushSubscriptions.map((s) => ({
      id: s.id, centerId: s.centerId, userId: s.userId, endpoint: s.endpoint,
      p256dh: s.p256dh, auth: s.auth, userAgent: str(s.userAgent),
      createdAt: toIso(s.createdAt), updatedAt: toIso(s.updatedAt),
    })),
  };

  const counts: Record<string, number> = {};
  for (const [key, rows] of Object.entries(data)) counts[key] = rows.length;

  return {
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    centerId,
    centre: centreName,
    centreSlug,
    counts,
    data,
  };
}

export function serializeBackup(dump: CenterBackupDump): string {
  return JSON.stringify(dump, null, 2);
}

const ALLOWED_ROLES = ["admin", "prof", "eleve"] as const;
const ALLOWED_INSCRIPTION_STATUTS = ["actif", "inactif"] as const;
const ALLOWED_PAIEMENT_METHODES = ["especes", "virement", "cheque", "autre"] as const;
const ALLOWED_PRESENCE_STATUTS = ["present", "absent"] as const;
const ALLOWED_SEANCE_STATUTS = ["planifiee", "en_cours", "terminee", "annulee"] as const;
const ALLOWED_STUDENT_TX_TYPES = ["PREPAYMENT", "COURSE_CONSUMPTION", "ADJUSTMENT", "REVERSAL"] as const;
const ALLOWED_STUDENT_TX_STATUTS = ["active", "reversed"] as const;
const ALLOWED_TEACHER_TX_TYPES = ["EARNING", "PAYMENT", "ADJUSTMENT", "REVERSAL", "REVERSE_COLLECTION", "CENTER_SETTLEMENT"] as const;
const ALLOWED_TEACHER_TX_STATUTS = ["active", "reversed", "pending"] as const;
const ALLOWED_MODES = ["FORWARD", "REVERSE"] as const;
const ALLOWED_DEBT_STATUS = ["OPEN", "PARTIAL", "PAID"] as const;
const ALLOWED_NIVEAU = ["primaire", "college", "lycee"] as const;
const ALLOWED_FILIERE = ["lettres", "economique", "informatique", "technique", "sciences", "math"] as const;
const ALLOWED_DOCUMENT_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

function pick<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

// Valide la structure du dump et renvoie les erreurs éventuelles.
export function validateCenterBackup(dump: any): string[] {
  const errors: string[] = [];
  if (!dump || typeof dump !== "object") return ["Fichier de backup invalide"];
  if (dump.kind !== BACKUP_KIND) errors.push("Type de fichier inconnu (backup centre attendu)");
  if (typeof dump.schemaVersion !== "string") errors.push("Version du schéma manquante");
  if (!dump.data || typeof dump.data !== "object") errors.push("Données de la sauvegarde manquantes");
  return errors;
}

// ─── Restauration ─────────────────────────────────────────────────────────────

export async function restoreCenterBackup(
  tx: Tx,
  centerId: string,
  dump: CenterBackupDump,
  mode: "merge" | "full"
): Promise<{ created: number; skipped: number; tempPasswords: { email: string; password: string }[]; logs: string[] }> {
  const idMap: Record<string, string> = {};
  const logs: string[] = [];
  const tempPasswords: { email: string; password: string }[] = [];
  let created = 0;
  let skipped = 0;
  const D = dump.data;

  if (mode === "full") {
    await tx.teacherTransaction.deleteMany({ where: { centerId } });
    await tx.teacherCenterDebt.deleteMany({ where: { centerId } });
    await tx.studentTransaction.deleteMany({ where: { centerId } });
    await tx.pushSubscription.deleteMany({ where: { centerId } });
    await tx.presence.deleteMany({ where: { seance: { groupe: { centerId } } } });
    await tx.seanceDocument.deleteMany({ where: { centerId } });
    await tx.paiement.deleteMany({ where: { groupe: { centerId } } });
    await tx.seance.deleteMany({ where: { groupe: { centerId } } });
    await tx.inscription.deleteMany({ where: { groupe: { centerId } } });
    await tx.tauxBenefice.deleteMany({ where: { prof: { centerId } } });
    await tx.notification.deleteMany({ where: { centerId } });
    await tx.groupe.deleteMany({ where: { centerId } });
    await tx.matiere.deleteMany({ where: { centerId } });
    logs.push("Mode complet : anciennes données opérationnelles supprimées");
  }

  // Utilisateurs (mots de passe préservés si le hash est exporté)
  let userCreated = 0;
  let userSkipped = 0;
  for (const u of D.utilisateurs || []) {
    const existing = await tx.utilisateur.findFirst({ where: { email: u.email, centerId } });
    if (existing) {
      idMap[u.id] = existing.id;
      userSkipped++;
      continue;
    }
    // email est UNIQUE au niveau mondial : s'il est déjà pris par un autre centre, on ne crée
    // pas ce compte (éviter une violation d'unicité qui annulerait toute la transaction)
    const emailTaken = await tx.utilisateur.findFirst({
      where: { email: u.email },
      select: { id: true, centerId: true },
    });
    if (emailTaken) {
      logs.push(`Compte « ${u.email} » ignoré : cet e-mail existe déjà (centre ${emailTaken.centerId}).`);
      skipped++;
      userSkipped++;
      continue;
    }
    const safeRole = pick(u.role, ALLOWED_ROLES, "eleve");
    let motDePasse: string | null =
      typeof u.motDePasse === "string" && u.motDePasse.startsWith("$2") ? u.motDePasse : null;
    let tempPassword: string | null = null;
    if (!motDePasse) {
      tempPassword = generateTemporaryPassword();
      motDePasse = await bcrypt.hash(tempPassword, 12);
      tempPasswords.push({ email: u.email, password: tempPassword });
    }
    const createdUser = await tx.utilisateur.create({
      data: {
        centerId,
        nom: u.nom, prenom: u.prenom, email: u.email, motDePasse: motDePasse!,
        telephone: str(u.telephone), role: safeRole,
        image: str(u.image),
        dateNaissance: u.dateNaissance ? date(u.dateNaissance) : null,
        actif: u.actif ?? false,
        peutGererEleves: u.peutGererEleves ?? false,
        peutEncaisserReverse: u.peutEncaisserReverse ?? false,
        codeEleve: str(u.codeEleve), codeProf: str(u.codeProf),
        niveau: pick(u.niveau, ALLOWED_NIVEAU, "college"),
        classe: str(u.classe), filiere: pick(u.filiere, ALLOWED_FILIERE, "sciences"),
        deletedAt: u.deletedAt ? date(u.deletedAt) : null,
        provider: u.provider ?? "credentials",
      },
    });
    idMap[u.id] = createdUser.id;
    userCreated++;
  }
  if (D.utilisateurs?.length) logs.push(`Utilisateurs: ${userCreated} créés, ${userSkipped} ignorés`);

  // Matières
  for (const m of D.matieres || []) {
    const existing = await tx.matiere.findFirst({ where: { centerId, nom: m.nom } });
    if (existing) { idMap[m.id] = existing.id; skipped++; continue; }
    const createdM = await tx.matiere.create({
      data: { centerId, nom: m.nom, description: str(m.description) },
    });
    idMap[m.id] = createdM.id;
    created++;
  }
  if (D.matieres?.length) logs.push(`Matières : ${D.matieres.length} traitées`);

  // Groupes
  for (const g of D.groupes || []) {
    const newProfId = g.profId ? idMap[g.profId] || null : null;
    const newMatiereId = g.matiereId ? idMap[g.matiereId] || null : null;
    const existing = await tx.groupe.findFirst({ where: { centerId, nom: g.nom } });
    if (existing) { idMap[g.id] = existing.id; skipped++; continue; }
    const createdG = await tx.groupe.create({
      data: {
        centerId, nom: g.nom, description: str(g.description),
        profId: newProfId, matiereId: newMatiereId,
        prixParSeance: g.prixParSeance != null ? Number(g.prixParSeance) : 0,
        forfaitMontant: g.forfaitMontant != null ? Number(g.forfaitMontant) : null,
        forfaitSeances: g.forfaitSeances != null ? Number(g.forfaitSeances) : null,
        capaciteMax: g.capaciteMax != null ? Number(g.capaciteMax) : null,
      },
    });
    idMap[g.id] = createdG.id;
    created++;
  }
  if (D.groupes?.length) logs.push(`Groupes : ${D.groupes.length} traités`);

  // Séances
  for (const s of D.seances || []) {
    const newGroupeId = idMap[s.groupeId];
    if (!newGroupeId) { skipped++; continue; }
    const existing = await tx.seance.findFirst({ where: { groupeId: newGroupeId, date: date(s.date) ?? new Date() } });
    if (existing) { idMap[s.id] = existing.id; skipped++; continue; }
    const createdS = await tx.seance.create({
      data: {
        groupeId: newGroupeId, date: date(s.date) ?? new Date(),
        heureDebut: s.heureDebut ? date(s.heureDebut) : null,
        heureFin: s.heureFin ? date(s.heureFin) : null,
        statut: pick(s.statut, ALLOWED_SEANCE_STATUTS, "planifiee"),
        notes: str(s.notes),
        prixParSeance: s.prixParSeance != null ? Number(s.prixParSeance) : null,
      },
    });
    idMap[s.id] = createdS.id;
    created++;
  }
  if (D.seances?.length) logs.push(`Séances : ${D.seances.length} traitées`);

  // Inscriptions
  for (const i of D.inscriptions || []) {
    const newEleveId = idMap[i.eleveId];
    const newGroupeId = idMap[i.groupeId];
    if (!newEleveId || !newGroupeId) { skipped++; continue; }
    const existing = await tx.inscription.findUnique({ where: { eleveId_groupeId: { eleveId: newEleveId, groupeId: newGroupeId } } });
    if (existing) { skipped++; continue; }
    await tx.inscription.create({
      data: {
        eleveId: newEleveId, groupeId: newGroupeId,
        dateInscription: (i.dateInscription && date(i.dateInscription)) ?? new Date(),
        statut: pick(i.statut, ALLOWED_INSCRIPTION_STATUTS, "actif"),
        ...(i.forfaitMontant != null && i.forfaitSeances != null
          ? { forfaitMontant: Number(i.forfaitMontant), forfaitSeances: Number(i.forfaitSeances), forfaitSetAt: i.forfaitSetAt ? date(i.forfaitSetAt) : new Date() }
          : {}),
      },
    });
    created++;
  }
  if (D.inscriptions?.length) logs.push(`Inscriptions : ${D.inscriptions.length} traitées`);

  // Présences (avec mapping id pour les transactions d'élèves)
  for (const p of D.presences || []) {
    const newSeanceId = idMap[p.seanceId];
    const newEleveId = idMap[p.eleveId];
    if (!newSeanceId || !newEleveId) { skipped++; continue; }
    const existing = await tx.presence.findUnique({ where: { seanceId_eleveId: { seanceId: newSeanceId, eleveId: newEleveId } } });
    if (existing) { idMap[p.id] = existing.id; skipped++; continue; }
    const createdP = await tx.presence.create({
      data: {
        seanceId: newSeanceId, eleveId: newEleveId,
        statut: pick(p.statut, ALLOWED_PRESENCE_STATUTS, "present"),
        enregistrePar: p.enregistrePar ? idMap[p.enregistrePar] || null : null,
        dateCreation: (p.dateCreation && date(p.dateCreation)) ?? new Date(),
        dateModification: (p.dateModification && date(p.dateModification)) ?? new Date(),
      },
    });
    idMap[p.id] = createdP.id;
    created++;
  }
  if (D.presences?.length) logs.push(`Présences : ${D.presences.length} traitées`);

  // Supports de séance.
  // Le JSON ne contient que les métadonnées : une ligne n'est réimportée que si
  // le fichier est réellement présent dans le store cible. On ne crée donc
  // JAMAIS une ligne pointant vers un fichier absent (sinon l'élève verrait un
  // support introuvable), et chaque fichier sauté est signalé dans le rapport.
  let docsSkipped = 0;
  for (const d of D.seanceDocuments || []) {
    const newSeanceId = idMap[d.seanceId];
    if (!newSeanceId || typeof d.pathname !== "string" || typeof d.fileName !== "string") {
      skipped++; docsSkipped++; continue;
    }
    // Vérifie l'existence réelle du fichier avant de créer la ligne.
    const head = await headDocument(d.pathname);
    if (!head) { skipped++; docsSkipped++; continue; }
    await tx.seanceDocument.create({
      data: {
        centerId,
        seanceId: newSeanceId,
        pathname: d.pathname,
        fileName: d.fileName.slice(0, 255),
        mimeType: pick(d.mimeType, ALLOWED_DOCUMENT_MIMES, "application/pdf"),
        sizeBytes: Number(d.sizeBytes) || 0,
        description: str(d.description),
        uploadedById: d.uploadedById ? idMap[d.uploadedById] || null : null,
        statut: "pret",
        verifiedAt: date(d.verifiedAt) ?? new Date(),
        createdAt: (d.createdAt && date(d.createdAt)) ?? new Date(),
      },
    });
    created++;
  }
  if (D.seanceDocuments?.length) {
    logs.push(
      docsSkipped === 0
        ? `Supports de séance : ${D.seanceDocuments.length} réimportés (fichiers vérifiés dans le stockage)`
        : `Supports de séance : ${D.seanceDocuments.length - docsSkipped} réimportés, ${docsSkipped} ignorés (séance introuvable ou fichier absent du stockage)`
    );
  }

  // Paiements
  for (const pay of D.paiements || []) {
    const newEleveId = idMap[pay.eleveId];
    const newGroupeId = idMap[pay.groupeId];
    if (!newEleveId || !newGroupeId) { skipped++; continue; }
    const existing = await tx.paiement.findFirst({
      where: { eleveId: newEleveId, groupeId: newGroupeId, montant: pay.montant, datePaiement: date(pay.datePaiement) ?? new Date() },
    });
    if (existing) { skipped++; continue; }
    await tx.paiement.create({
      data: {
        eleveId: newEleveId, groupeId: newGroupeId, montant: pay.montant,
        datePaiement: date(pay.datePaiement) ?? new Date(),
        methodePaiement: pick(pay.methodePaiement, ALLOWED_PAIEMENT_METHODES, "especes"),
        reference: str(pay.reference), notes: str(pay.notes),
      },
    });
    created++;
  }
  if (D.paiements?.length) logs.push(`Paiements : ${D.paiements.length} traités`);

  // Taux bénéfices
  for (const t of D.tauxBenefices || []) {
    const newProfId = idMap[t.profId];
    if (!newProfId) { skipped++; continue; }
    const existing = await tx.tauxBenefice.findUnique({ where: { profId: newProfId } });
    if (existing) { skipped++; continue; }
    await tx.tauxBenefice.create({
      data: { profId: newProfId, tauxPourcentage: t.tauxPourcentage != null ? Number(t.tauxPourcentage) : 0 },
    });
    created++;
  }
  if (D.tauxBenefices?.length) logs.push(`Taux de bénéfice : ${D.tauxBenefices.length} traités`);

  // Notifications
  for (const n of D.notifications || []) {
    const destinataireId = idMap[n.destinataireId];
    if (!destinataireId) { skipped++; continue; }
    await tx.notification.create({
      data: {
        centerId, destinataireId, type: n.type, titre: n.titre,
        message: n.message, lu: !!n.lu, createdAt: (n.createdAt && date(n.createdAt)) ?? new Date(),
      },
    });
    created++;
  }
  if (D.notifications?.length) logs.push(`Notifications : ${D.notifications.length} traitées`);

  // Transactions élèves
  for (const t of D.studentTransactions || []) {
    const newEleveId = idMap[t.eleveId];
    if (!newEleveId) { skipped++; continue; }
    const newAttendanceId = t.attendanceId ? idMap[t.attendanceId] || null : null;
    const existing = await tx.studentTransaction.findFirst({
      where: {
        centerId, eleveId: newEleveId,
        type: pick(t.type, ALLOWED_STUDENT_TX_TYPES, "PREPAYMENT"),
        signedAmount: t.signedAmount != null ? Number(t.signedAmount) : 0,
        date: date(t.date) ?? new Date(),
      },
    });
    if (existing) { skipped++; continue; }
    const createdT = await tx.studentTransaction.create({
      data: {
        centerId, eleveId: newEleveId,
        type: pick(t.type, ALLOWED_STUDENT_TX_TYPES, "PREPAYMENT"),
        status: pick(t.status, ALLOWED_STUDENT_TX_STATUTS, "active"),
        amount: t.amount != null ? Number(t.amount) : 0,
        signedAmount: t.signedAmount != null ? Number(t.signedAmount) : 0,
        description: t.description || "",
        paymentMethod: t.paymentMethod ? pick(t.paymentMethod, ALLOWED_PAIEMENT_METHODES, "autre") : null,
        date: date(t.date) ?? new Date(),
        time: t.time ? date(t.time) : null,
        receiptNumber: str(t.receiptNumber), reference: str(t.reference),
        attendanceId: newAttendanceId,
        idempotencyKey: t.idempotencyKey ? `restore-${t.idempotencyKey}-${Date.now()}` : null,
        notes: str(t.notes),
        createdBy: t.createdBy ? idMap[t.createdBy] || null : null,
        reversalOfId: t.reversalOfId ? idMap[t.reversalOfId] || null : null,
        reversedById: t.reversedById ? idMap[t.reversedById] || null : null,
        reversedAt: t.reversedAt ? date(t.reversedAt) : null,
      },
    });
    idMap[t.id] = createdT.id;
    created++;
  }
  if (D.studentTransactions?.length) logs.push(`Transactions élèves : ${D.studentTransactions.length} traitées`);

  // Dettes professeur → centre (mode REVERSE)
  for (const d of D.teacherDebts || []) {
    const newTeacherId = idMap[d.teacherId];
    if (!newTeacherId) { skipped++; continue; }
    const newStudentId = d.studentId ? idMap[d.studentId] || null : null;
    const newSeanceId = d.seanceId ? idMap[d.seanceId] || null : null;
    const createdAt = (d.createdAt && date(d.createdAt)) ?? new Date();
    const existing = await tx.teacherCenterDebt.findFirst({
      where: { centerId, teacherId: newTeacherId, amountDue: d.amountDue != null ? Number(d.amountDue) : 0, createdAt },
    });
    if (existing) { idMap[d.id] = existing.id; skipped++; continue; }
    const createdD = await tx.teacherCenterDebt.create({
      data: {
        centerId, teacherId: newTeacherId,
        studentId: newStudentId, seanceId: newSeanceId,
        amountDue: d.amountDue != null ? Number(d.amountDue) : 0,
        amountPaid: d.amountPaid != null ? Number(d.amountPaid) : 0,
        balance: d.balance != null ? Number(d.balance) : 0,
        status: pick(d.status, ALLOWED_DEBT_STATUS, "OPEN"),
        notes: str(d.notes),
        settledAt: d.settledAt ? date(d.settledAt) : null,
        createdAt,
      },
    });
    idMap[d.id] = createdD.id;
    created++;
  }
  if (D.teacherDebts?.length) logs.push(`Dettes professeur : ${D.teacherDebts.length} traitées`);

  // Transactions professeurs
  for (const t of D.teacherTransactions || []) {
    const newTeacherId = idMap[t.teacherId];
    if (!newTeacherId) { skipped++; continue; }
    const existing = await tx.teacherTransaction.findFirst({
      where: {
        centerId, teacherId: newTeacherId,
        type: pick(t.type, ALLOWED_TEACHER_TX_TYPES, "EARNING"),
        signedAmount: t.signedAmount != null ? Number(t.signedAmount) : 0,
        date: date(t.date) ?? new Date(),
      },
    });
    if (existing) { idMap[t.id] = existing.id; skipped++; continue; }
    const createdT = await tx.teacherTransaction.create({
      data: {
        centerId, teacherId: newTeacherId,
        type: pick(t.type, ALLOWED_TEACHER_TX_TYPES, "EARNING"),
        status: pick(t.status, ALLOWED_TEACHER_TX_STATUTS, "active"),
        mode: pick(t.mode, ALLOWED_MODES, "FORWARD"),
        amount: t.amount != null ? Number(t.amount) : 0,
        signedAmount: t.signedAmount != null ? Number(t.signedAmount) : 0,
        description: t.description || "",
        paymentMethod: t.paymentMethod ? pick(t.paymentMethod, ALLOWED_PAIEMENT_METHODES, "autre") : null,
        date: date(t.date) ?? new Date(),
        time: t.time ? date(t.time) : null,
        receiptNumber: str(t.receiptNumber), reference: str(t.reference), notes: str(t.notes),
        createdBy: t.createdBy ? idMap[t.createdBy] || null : null,
        reversalOfId: t.reversalOfId ? idMap[t.reversalOfId] || null : null,
        reversedById: t.reversedById ? idMap[t.reversedById] || null : null,
        reversedAt: t.reversedAt ? date(t.reversedAt) : null,
        amountReceived: t.amountReceived != null ? Number(t.amountReceived) : null,
        centerFee: t.centerFee != null ? Number(t.centerFee) : null,
        netAmount: t.netAmount != null ? Number(t.netAmount) : null,
        collectionPct: t.collectionPct != null ? Number(t.collectionPct) : null,
        studentId: t.studentId ? idMap[t.studentId] || null : null,
        seanceId: t.seanceId ? idMap[t.seanceId] || null : null,
        direction: str(t.direction),
        linkedDebtId: t.linkedDebtId ? idMap[t.linkedDebtId] || null : null,
      },
    });
    idMap[t.id] = createdT.id;
    created++;
  }
  if (D.teacherTransactions?.length) logs.push(`Transactions professeurs : ${D.teacherTransactions.length} traitées`);

  // Relie chaque dette à ses transactions de collecte / règlement
  for (const d of D.teacherDebts || []) {
    const newDebtId = idMap[d.id];
    if (!newDebtId) continue;
    const reverseTxId = d.reverseTxId ? idMap[d.reverseTxId] || null : null;
    const settlementTxId = d.settlementTxId ? idMap[d.settlementTxId] || null : null;
    if (!reverseTxId && !settlementTxId) continue;
    await tx.teacherCenterDebt.update({ where: { id: newDebtId }, data: { reverseTxId, settlementTxId } });
  }

  // Push subscriptions (facultatif — nécessite des utilisateurs existants)
  let pushSkipped = 0;
  for (const s of D.pushSubscriptions || []) {
    const newUserId = idMap[s.userId];
    if (!newUserId) { pushSkipped++; skipped++; continue; }
    await tx.pushSubscription.create({
      data: {
        centerId, userId: newUserId, endpoint: s.endpoint,
        p256dh: s.p256dh, auth: s.auth, userAgent: str(s.userAgent),
      },
    });
    created++;
  }
  if (D.pushSubscriptions?.length) logs.push(`Abonnements push : ${D.pushSubscriptions.length - pushSkipped} traités, ${pushSkipped} ignorés`);

  return { created, skipped, tempPasswords, logs };
}
