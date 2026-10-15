import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  ALLOWED_MIME_TYPES,
  authorizeSeanceAccess,
  buildDocumentPathname,
  isAllowedMime,
  loadDocUser,
  maxBytesForMime,
  MAX_FILES_PER_SEANCE,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  sanitizeFileName,
} from "@/lib/seance-documents";
import { isBlobStoreConfigured } from "@/lib/seance-documents-storage";

const MAX_DESCRIPTION_LENGTH = 500;

/**
 * GET /api/prof/seances/[id]/documents
 * Liste les supports d'une séance. Le professeur doit être le propriétaire du
 * groupe et du même centre : vérifié côté serveur via la chaîne
 * séance → groupe → centre.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, frozen, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const user = await loadDocUser((session.user as any).id, !!frozen);
    if (!user) {
      return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 401 });
    }

    const { id } = await params;
    const scope = await authorizeSeanceAccess(user, id);
    if (!scope.ok) return scope.response;

    const documents = await prisma.seanceDocument.findMany({
      where: { seanceId: scope.seance.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        uploadedById: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        description: true,
        statut: true,
        createdAt: true,
        uploadedBy: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json({
      seance: { id: scope.seance.id, date: scope.seance.date, statut: scope.seance.statut },
      groupe: { id: scope.groupe.id, nom: scope.groupe.nom },
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        description: d.description,
        // Un dépôt non confirmé reste visible mais signalé : l'enseignant peut
        // relancer ou supprimer, et le cron nettoie les dépôts abandonnés.
        statut: d.statut,
        createdAt: d.createdAt,
        uploadedBy: d.uploadedBy
          ? { id: d.uploadedBy.id, nom: d.uploadedBy.nom, prenom: d.uploadedBy.prenom }
          : null,
        canDelete: d.uploadedById === user.id,
      })),
      limits: {
        maxFiles: MAX_FILES_PER_SEANCE,
        remaining: Math.max(0, MAX_FILES_PER_SEANCE - documents.length),
        allowedMimeTypes: ALLOWED_MIME_TYPES,
        maxBytesPdf: MAX_PDF_BYTES,
        maxBytesImage: MAX_IMAGE_BYTES,
      },
    });
  } catch (err) {
    logger.error("Erreur lors de la récupération des supports (prof)", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/**
 * POST /api/prof/seances/[id]/documents
 *
 * Étape 1/3 de l'upload : crée la ligne "en_attente" AVANT l'envoi du fichier
 * au Blob. Cet ordre est volontaire — si l'upload échoue, on a une ligne
 * détectable (nettoyée par le cron) plutôt qu'un Blob orphelin invisible.
 *
 * Le chemin de stockage est calculé par le serveur : le navigateur ne fournit
 * que le nom, le type et la taille déclarés, tous revérifiés.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("POST", PROF_ROLES);
    if (error) return error;

    const user = await loadDocUser((session.user as any).id, false);
    if (!user) {
      return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 401 });
    }

    if (!isBlobStoreConfigured()) {
      return NextResponse.json(
        { error: "Stockage de fichiers non configuré sur cet environnement" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const scope = await authorizeSeanceAccess(user, id, { write: true });
    if (!scope.ok) return scope.response;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }

    const { fileName, mimeType, sizeBytes, description } = body ?? {};

    if (!isAllowedMime(mimeType)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé (PDF, JPEG, PNG ou WEBP uniquement)" },
        { status: 400 }
      );
    }
    const size = typeof sizeBytes === "number" ? Math.floor(sizeBytes) : NaN;
    const limit = maxBytesForMime(mimeType);
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Taille de fichier invalide" }, { status: 400 });
    }
    if (size > limit) {
      return NextResponse.json(
        { error: `Fichier trop volumineux : maximum ${limit / (1024 * 1024)} Mo` },
        { status: 413 }
      );
    }

    const desc =
      typeof description === "string" && description.trim().length > 0
        ? description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
        : null;

    const existing = await prisma.seanceDocument.count({ where: { seanceId: scope.seance.id } });
    if (existing >= MAX_FILES_PER_SEANCE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_SEANCE} supports par séance` },
        { status: 409 }
      );
    }

    const safeName = sanitizeFileName(fileName, mimeType);
    const pathname = buildDocumentPathname(user.centerId, scope.seance.id, safeName, mimeType);

    const document = await prisma.seanceDocument.create({
      data: {
        centerId: user.centerId,
        seanceId: scope.seance.id,
        uploadedById: user.id,
        pathname,
        fileName: safeName,
        mimeType,
        sizeBytes: size,
        description: desc,
      },
      select: { id: true, pathname: true, fileName: true, mimeType: true, sizeBytes: true, statut: true },
    });

    return NextResponse.json(
      { documentId: document.id, pathname: document.pathname, fileName: document.fileName },
      { status: 201 }
    );
  } catch (err) {
    logger.error("Erreur lors de la création d'un dépôt de support", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
