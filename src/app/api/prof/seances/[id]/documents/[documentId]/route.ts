import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { authorizeDocumentAccess, loadDocUser } from "@/lib/seance-documents";
import { deleteDocumentBlob, isBlobStoreConfigured } from "@/lib/seance-documents-storage";


/**
 * DELETE /api/prof/seances/[id]/documents/[documentId]
 *
 * Ordre IMPÉRATIF : on supprime d'abord le Blob, puis la ligne.
 * L'inverse laisserait des fichiers orphels invisibles (donc jamais
 * nettoyés). Si la suppression du Blob échoue, la ligne est conservée et
 * l'enseignant peut réessayer : mieux vaut un support affiché qu'un fichier
 * fantôme consommant du quota.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("DELETE", PROF_ROLES);
    if (error) return error;

    const user = await loadDocUser((session.user as any).id, false);
    if (!user) {
      return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 401 });
    }

    const { id, documentId } = await params;
    const scope = await authorizeDocumentAccess(user, documentId, { write: true, ownerOnly: true });
    if (!scope.ok) return scope.response;

    if (scope.document.seanceId !== id) {
      return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
    }

    // Si le stockage n'est pas configuré, on ne peut pas garantir que le
    // fichier a disparu : on refuse alors la suppression plutôt que d'orpheliner
    // un fichier invisible (le quota Vercel fuiterait sans jamais le nettoyer).
    if (!isBlobStoreConfigured()) {
      return NextResponse.json(
        { error: "Stockage de fichiers non configuré : suppression impossible pour ne pas laisser de fichier orphelin." },
        { status: 503 }
      );
    }

    try {
      await deleteDocumentBlob(scope.document.pathname);
    } catch (err) {
      logger.error("Suppression du Blob impossible, ligne conservée", {
        documentId,
        error: err,
      });
      return NextResponse.json(
        { error: "Le fichier n'a pas pu être supprimé du stockage. Réessayez." },
        { status: 502 }
      );
    }

    await prisma.seanceDocument.delete({ where: { id: scope.document.id } });

    return NextResponse.json({ deleted: true, id: scope.document.id });
  } catch (err) {
    logger.error("Erreur lors de la suppression d'un support", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
