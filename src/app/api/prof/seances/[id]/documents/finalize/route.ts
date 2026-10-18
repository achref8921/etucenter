import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  authorizeDocumentAccess,
  loadDocUser,
  maxBytesForMime,
  notifyGroupeStudentsOfDocument,
  sniffMime,
} from "@/lib/seance-documents";
import {
  BlobMissingError,
  BlobNotConfiguredError,
  deleteDocumentBlob,
  headDocument,
  isBlobStoreConfigured,
  readDocumentHead,
} from "@/lib/seance-documents-storage";


/**
 * POST /api/prof/seances/[id]/documents/finalize
 *
 * Étape 3/3 : le navigateur a fini d'envoyer le fichier, on ne considère le
 * support « pret » qu'après contrôle RÉEL du blob :
 *   - la taille correspond exactement à celle annoncée (pas de triche) ;
 *   - les magic bytes correspondent au MIME enregistré (un PDF renommé .jpg
 *     est rejeté) ;
 *   - la ligne appartient bien à la séance, au centre et au professeur.
 *
 * Si le contrôle échoue, la ligne ET le blob sont supprimés : pas de fichier
 * inutilisable qui occupe du quota.
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
      return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
    }

    const { id } = await params;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }
    const documentId = body?.documentId;

    // Autorisation complète : la ligne doit appartenir à CETTE séance, à ce
    // centre, et avoir été déposée par CE professeur.
    const scope = await authorizeDocumentAccess(user, documentId, { write: true, ownerOnly: true });
    if (!scope.ok) return scope.response;

    if (scope.document.seanceId !== id) {
      return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
    }
    if (scope.document.statut === "pret") {
      return NextResponse.json({ document: { id: scope.document.id, statut: "pret" } });
    }

    const cleanupAndFail = async (message: string, status: number) => {
      await deleteDocumentBlob(scope.document.pathname).catch((e) => logger.error("Nettoyage blob impossible", { error: e }));
      await prisma.seanceDocument
        .delete({ where: { id: scope.document.id } })
        .catch((e) => logger.error("Suppression de la ligne impossible", { error: e }));
      return NextResponse.json({ error: message }, { status });
    };

    let head;
    try {
      head = await headDocument(scope.document.pathname);
    } catch (err) {
      if (err instanceof BlobNotConfiguredError) {
        return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
      }
      throw err;
    }
    if (!head) {
      return cleanupAndFail("Le fichier n'a pas été reçu. Réessayez.", 400);
    }

    const limit = maxBytesForMime(scope.document.mimeType);
    if (head.size !== scope.document.sizeBytes) {
      return cleanupAndFail(
        `Taille reçue (${head.size} octets) différente de la taille annoncée. Réessayez.`,
        400
      );
    }
    if (head.size > limit) {
      return cleanupAndFail("Fichier trop volumineux pour ce type.", 413);
    }

    let magic: string | null = null;
    try {
      magic = sniffMime(await readDocumentHead(scope.document.pathname, 12));
    } catch (err) {
      if (err instanceof BlobMissingError) {
        return cleanupAndFail("Le fichier n'a pas été reçu. Réessayez.", 400);
      }
      throw err;
    }
    if (magic !== scope.document.mimeType) {
      return cleanupAndFail(
        "Le contenu du fichier ne correspond pas à son type (PDF, JPEG, PNG ou WEBP attendus).",
        400
      );
    }

    const updated = await prisma.seanceDocument.update({
      where: { id: scope.document.id },
      data: {
        statut: "pret",
        verifiedAt: new Date(),
        sizeBytes: head.size,
        // On conserve le MIME DÉCLARÉ, déjà validé contre les magic bytes.
        // head.contentType vaut souvent "application/octet-stream" sur un
        // upload direct navigateur : le stocker casserait l'aperçu et le
        // contrôle de type en lecture.
        mimeType: scope.document.mimeType,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, statut: true, verifiedAt: true },
    });

    // Le support devient visible : on prévient les élèves inscrits du groupe.
    // Un échec de notification ne doit jamais annuler un dépôt valide.
    await notifyGroupeStudentsOfDocument(
      { ...scope.seance, groupe: scope.groupe },
      scope.document.fileName
    ).catch((e) =>
      logger.error("Notification de dépôt impossible", { documentId: scope.document.id, error: e })
    );

    return NextResponse.json({ document: updated });
  } catch (err) {
    logger.error("Erreur lors de la finalisation d'un support", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
