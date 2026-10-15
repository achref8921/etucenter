import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { deleteDocumentBlob, isBlobStoreConfigured } from "@/lib/seance-documents-storage";

/**
 * Nettoyage des supports lors des suppressions métier (séance, groupe, centre).
 *
 * INVARIANT : un fichier Vercel Blob ne doit JAMAIS survivre à sa ligne en
 * base, et une ligne ne doit JAMAIS disparaître en laissant un fichier
 * derrière elle. Comme les deux systèmes ne partagent pas de transaction, on
 * applique l'ordre suivant :
 *
 *   1. on recense les chemins des supports concernés ;
 *   2. on SUPPRIME les Blobs ;
 *   3. seulement en cas de succès total, on supprime les lignes en base.
 *
 * Si l'étape 2 échoue, l'appelant doit ANNULER la suppression métier : on
 * préfère un support encore présent qu'un fichier orphelin invisible, jamais
 * nettoyé, qui continuerait de consommer du quota.
 */

export class DocumentCleanupError extends Error {
  readonly failedPathnames: string[];
  constructor(failedPathnames: string[]) {
    super(
      `Suppression impossible : ${failedPathnames.length} fichier(s) n'ont pas pu être supprimés du stockage.`
    );
    this.name = "DocumentCleanupError";
    this.failedPathnames = failedPathnames;
  }
}

/** Supprime une liste de Blobs ; lève une erreur si l'un d'eux échoue. */
export async function deleteDocumentBlobsOrThrow(pathnames: string[]): Promise<number> {
  if (pathnames.length === 0) return 0;
  if (!isBlobStoreConfigured()) {
    // Sans store configuré, on ne peut pas garantir le nettoyage : on refuse
    // de supprimer des lignes, sinon des fichiers resteraient orphelins.
    throw new DocumentCleanupError(pathnames);
  }

  const failed: string[] = [];
  for (const pathname of pathnames) {
    try {
      await deleteDocumentBlob(pathname);
    } catch (err) {
      failed.push(pathname);
      logger.error("Suppression d'un Blob de support impossible", { pathname, error: err });
    }
  }
  if (failed.length > 0) throw new DocumentCleanupError(failed);
  return pathnames.length;
}

/** Chemin de tous les supports d'une liste de séances. */
export async function collectSeanceDocumentPaths(seanceIds: string[]): Promise<string[]> {
  if (seanceIds.length === 0) return [];
  const rows = await prisma.seanceDocument.findMany({
    where: { seanceId: { in: seanceIds } },
    select: { pathname: true },
  });
  return rows.map((r) => r.pathname);
}

/** Chemin de tous les supports des séances d'un groupe. */
export async function collectGroupeDocumentPaths(groupeId: string): Promise<string[]> {
  const rows = await prisma.seanceDocument.findMany({
    where: { seance: { groupeId } },
    select: { pathname: true },
  });
  return rows.map((r) => r.pathname);
}

/**
 * Nettoyage complet avant la suppression d'un groupe : Blobs des séances du
 * groupe, puis les lignes (normalement supprimées en cascade par la suite).
 */
export async function purgeGroupeDocuments(groupeId: string): Promise<number> {
  const pathnames = await collectGroupeDocumentPaths(groupeId);
  const deleted = await deleteDocumentBlobsOrThrow(pathnames);
  if (deleted > 0) {
    logger.info("Fichiers de supports supprimés avant suppression du groupe", {
      groupeId,
      count: deleted,
    });
  }
  return deleted;
}

/** Nettoyage complet avant la suppression d'une séance. */
export async function purgeSeanceDocuments(seanceId: string): Promise<number> {
  const pathnames = await collectSeanceDocumentPaths([seanceId]);
  const deleted = await deleteDocumentBlobsOrThrow(pathnames);
  if (deleted > 0) {
    logger.info("Fichiers de supports supprimés avant suppression de la séance", {
      seanceId,
      count: deleted,
    });
  }
  return deleted;
}
