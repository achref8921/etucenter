import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

/**
 * Supports pédagogiques d'une séance (SeanceDocument).
 *
 * Règle d'isolation appliquée partout (CENTER → GROUPE → SEANCE → DOCUMENT) :
 *   - `centerId` seul n'est JAMAIS une autorisation suffisante ;
 *   - un professeur doit être `groupe.profId` ET dans le même centre ;
 *   - un élève doit avoir une inscription ACTIVE dans le groupe de la séance ;
 *   - les centres sont étanches : une ressource d'un autre centre renvoie 404
 *     (et non 403) pour ne pas révéler son existence.
 */

export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const MAX_FILES_PER_SEANCE = 20;
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 120;
export const PATHNAME_PREFIX = "seances";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMime(value: unknown): value is AllowedMime {
  return typeof value === "string" && (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function maxBytesForMime(mime: string): number {
  return mime === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

export function humanMaxBytes(mime: string): string {
  const mb = maxBytesForMime(mime) / (1024 * 1024);
  return `${mb} MB`;
}

const EXTENSION_BY_MIME: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMime(mime: AllowedMime): string {
  return EXTENSION_BY_MIME[mime];
}

/**
 * Nom de fichier affiché : lisible, mais sans séparateur de chemin, sans
 * caractère de contrôle, et avec une extension imposée par le type validé
 * (un `.pdf` déclaré sur un JPEG devient un `.jpg`).
 */
export function sanitizeFileName(raw: unknown, mime: AllowedMime): string {
  const input = typeof raw === "string" ? raw : "";
  const withoutPath = input.split(/[\\/]/).pop() ?? "";
  const cleaned = withoutPath
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/%/g, "")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\s]+/, "")
    .trim();

  const ext = extensionForMime(mime);
  // L'extension affichée doit toujours être celle du type RÉELLEMENT validé :
  // `piege.exe` déposé en PDF devient `piege.pdf`, et non `piege.exe.pdf`.
  // En revanche `Chapitre 1.2.pdf` garde son nom intact.
  const trailingExt = cleaned.match(/\.[A-Za-z0-9]{1,10}$/)?.[0].toLowerCase() ?? null;
  const base =
    trailingExt === `.${ext}` ? cleaned : cleaned.replace(/\.[A-Za-z0-9]{1,10}$/, "");
  const withoutTrailing = base.replace(/[. ]+$/, "");
  const safeBase = (withoutTrailing || "support").slice(0, MAX_FILE_NAME_LENGTH).trim() || "support";
  return safeBase.toLowerCase().endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`;
}

/** Segment ASCII sûr pour le chemin de stockage (espaces et accents retirés). */
export function toStorageSegment(displayName: string, mime: AllowedMime): string {
  const ext = extensionForMime(mime);
  const base = displayName.replace(new RegExp(`\\.${ext}$`, "i"), "");  const ascii = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/[.-]+$/, "")
    .slice(0, 80);
  return `${ascii || "support"}.${ext}`;
}

/** Chemin de stockage : {centerId}/seances/{seanceId}/{random}-{nom} */
export function buildDocumentPathname(
  centerId: string,
  seanceId: string,
  fileName: string,
  mime: AllowedMime
): string {
  const randomSuffix = randomBytes(6).toString("hex");
  return `${centerId}/${PATHNAME_PREFIX}/${seanceId}/${randomSuffix}-${toStorageSegment(fileName, mime)}`;
}

export const PATHNAME_RE = new RegExp(
  `^[0-9a-fA-F-]{36}/${PATHNAME_PREFIX}/[0-9a-fA-F-]{36}/[0-9a-zA-Z-]+-[A-Za-z0-9._-]+$`
);

export function isValidDocumentPathname(value: unknown): value is string {
  return typeof value === "string" && value.length <= 450 && PATHNAME_RE.test(value);
}

/** Détection du type réel par magic bytes (le Content-Type déclaré peut mentir). */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function isPreviewableMime(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}

export interface DocUser {
  id: string;
  role: string;
  centerId: string;
  frozen: boolean;
}

/**
 * Contexte utilisateur issu de la BASE (et non du JWT) : un jeton signé ne
 * doit jamais suffire à contourner l'isolation si le compte a changé de centre
 * ou a été désactivé.
 */
export async function loadDocUser(userId: string, frozenFromSession: boolean): Promise<DocUser | null> {
  const user = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { id: true, role: true, centerId: true, actif: true, ghost: true, deletedAt: true },
  });
  if (!user || user.ghost || user.deletedAt || !user.actif) return null;
  return { id: user.id, role: user.role, centerId: user.centerId, frozen: frozenFromSession };
}

export function forbidden(message = "Non autorisé"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
}

export type SeanceScope = {
  ok: true;
  seance: { id: string; date: Date; statut: string; notes: string | null };
  groupe: { id: string; nom: string; profId: string | null; centerId: string };
};
export type ScopeFailure = { ok: false; response: NextResponse };
export type ScopeResult = SeanceScope | ScopeFailure;

/**
 * Chaîne d'appartenance : séance → groupe → centre, puis la relation
 * spécifique au rôle. `write` ajoute les contraintes de modification.
 */
export async function authorizeSeanceAccess(
  user: DocUser,
  seanceId: unknown,
  options: { write?: boolean } = {}
): Promise<ScopeFailure | SeanceScope> {
  if (typeof seanceId !== "string" || !UUID_RE.test(seanceId)) {
    return { ok: false, response: NextResponse.json({ error: "Identifiant de séance invalide" }, { status: 400 }) };
  }
  if (options.write && user.frozen) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Compte gelé : aucune modification autorisée", frozen: true },
        { status: 403 }
      ),
    };
  }

  const seance = await prisma.seance.findUnique({
    where: { id: seanceId },
    select: {
      id: true,
      date: true,
      statut: true,
      notes: true,
      groupe: { select: { id: true, nom: true, profId: true, centerId: true } },
    },
  });

  // 404 : la séance n'existe pas OU appartient à un autre centre.
  if (!seance) return { ok: false, response: notFound() };
  if (seance.groupe.centerId !== user.centerId && user.role !== "super_admin") {
    return { ok: false, response: notFound() };
  }

  if (user.role === "prof") {
    if (seance.groupe.profId !== user.id) {
      return { ok: false, response: forbidden("Vous n'êtes pas le professeur de ce groupe") };
    }
    return { ok: true, seance, groupe: seance.groupe };
  }

  if (user.role === "eleve") {
    const inscription = await prisma.inscription.findFirst({
      where: { eleveId: user.id, groupeId: seance.groupe.id, statut: "actif" },
      select: { id: true },
    });
    if (!inscription) {
      return { ok: false, response: forbidden("Vous n'êtes pas inscrit à ce groupe") };
    }
    return { ok: true, seance, groupe: seance.groupe };
  }

  if (user.role === "admin") {
    // L'admin du centre : lecture et supervision, y compris sur des groupes
    // dont il n'est pas le professeur.
    return { ok: true, seance, groupe: seance.groupe };
  }

  if (user.role === "super_admin") {
    return { ok: true, seance, groupe: seance.groupe };
  }

  return { ok: false, response: forbidden() };
}

export type DocumentScope = SeanceScope & {
  document: {
    id: string;
    centerId: string;
    seanceId: string;
    uploadedById: string | null;
    pathname: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    description: string | null;
    statut: string;
    verifiedAt: Date | null;
    createdAt: Date;
  };
};

/** Chaîne document → séance → groupe → centre, puis relation de rôle. */
export async function authorizeDocumentAccess(
  user: DocUser,
  documentId: unknown,
  options: { write?: boolean; ownerOnly?: boolean } = {}
): Promise<ScopeFailure | DocumentScope> {
  if (typeof documentId !== "string" || !UUID_RE.test(documentId)) {
    return { ok: false, response: NextResponse.json({ error: "Identifiant de document invalide" }, { status: 400 }) };
  }
  if (options.write && user.frozen) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Compte gelé : aucune modification autorisée", frozen: true },
        { status: 403 }
      ),
    };
  }

  const document = await prisma.seanceDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      centerId: true,
      seanceId: true,
      uploadedById: true,
      pathname: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      description: true,
      statut: true,
      verifiedAt: true,
      createdAt: true,
      seance: {
        select: {
          id: true,
          date: true,
          statut: true,
          notes: true,
          groupe: { select: { id: true, nom: true, profId: true, centerId: true } },
        },
      },
    },
  });

  if (!document) return { ok: false, response: notFound() };

  // Étanchéité des centres : 404 pour un document d'un autre tenant.
  if (document.centerId !== user.centerId && user.role !== "super_admin") {
    return { ok: false, response: notFound() };
  }
  // Cohérence de la chaîne : le centerId du document doit correspondre à celui
  // déduit par la chaîne document → séance → groupe → centre.
  if (document.centerId !== document.seance.groupe.centerId) {
    return { ok: false, response: notFound() };
  }

  const base = {
    seance: {
      id: document.seance.id,
      date: document.seance.date,
      statut: document.seance.statut,
      notes: document.seance.notes,
    },
    groupe: document.seance.groupe,
  };

  if (user.role === "prof") {
    if (document.seance.groupe.profId !== user.id) {
      return { ok: false, response: forbidden("Vous n'êtes pas le professeur de ce groupe") };
    }
    if (options.ownerOnly && options.write && document.uploadedById !== user.id) {
      return { ok: false, response: forbidden("Seul le professeur ayant ajouté ce support peut le supprimer") };
    }
    return { ok: true, ...base, document };
  }

  if (user.role === "eleve") {
    if (options.write) {
      return { ok: false, response: forbidden("Les élèves ne peuvent pas modifier les supports") };
    }
    const inscription = await prisma.inscription.findFirst({
      where: { eleveId: user.id, groupeId: document.seance.groupe.id, statut: "actif" },
      select: { id: true },
    });
    if (!inscription) {
      return { ok: false, response: forbidden("Vous n'êtes pas inscrit à ce groupe") };
    }
    return { ok: true, ...base, document };
  }

  if (user.role === "admin" || user.role === "super_admin") {
    if (options.ownerOnly && user.role === "admin") {
      return { ok: false, response: forbidden("Action réservée au propriétaire du support") };
    }
    return { ok: true, ...base, document };
  }

  return { ok: false, response: forbidden() };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export type NotifiableSeance = {
  id: string;
  date: Date;
  groupe: { id: string; nom: string; centerId: string };
};

/**
 * Prévient les élèves ACTIFS du groupe qu'un support a été ajouté.
 * Ne lève jamais : une notification ratée ne doit pas invalider un dépôt.
 */
export async function notifyGroupeStudentsOfDocument(
  seance: NotifiableSeance,
  fileName: string
): Promise<void> {
  try {
    const inscriptions = await prisma.inscription.findMany({
      where: { groupeId: seance.groupe.id, statut: "actif" },
      select: { eleveId: true },
    });
    const eleveIds = inscriptions.map((i) => i.eleveId);
    if (eleveIds.length === 0) return;

    const dateStr = seance.date.toISOString().slice(0, 10);
    const titre = "Nouveau support de séance";
    const message = `Un support « ${fileName} » a été ajouté à la séance du ${dateStr} du groupe "${seance.groupe.nom}".`;

    await prisma.notification.createMany({
      data: eleveIds.map((destinataireId) => ({
        centerId: seance.groupe.centerId,
        destinataireId,
        titre,
        message,
        type: "support_seance_ajoute",
      })),
    });
    await sendPushToUsers(eleveIds, {
      title: titre,
      body: message,
      url: "/eleve/groupes",
    });
  } catch {
    // silencieux : voir le commentaire de la fonction
  }
}
