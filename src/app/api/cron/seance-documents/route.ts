import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  deleteDocumentBlob,
  headDocument,
  isBlobStoreConfigured,
  listBlobsUnder,
} from "@/lib/seance-documents-storage";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/seance-documents[?centerId=...]
 *
 * Rattrapage des dépôts abandonnés et des fichiers orphelins.
 *
 * Le planificateur Vercel n'appelle qu'un chemin statique : sans `centerId`, on
 * parcourt donc les centres un par un. Le cloisonnement reste STRICT à chaque
 * itération : on ne liste et on ne supprime que sous `{centerId}/seances/`, et
 * on ne compare qu'aux lignes de CE centre. Un fichier d'un autre centre ne peut
 * donc être ni lu, ni supprimé, ni même compté.
 *
 *  1. Dépôts abandonnés : lignes « en_attente » anciennes SANS fichier dans le
 *     Blob → ligne supprimée (le dépôt a échoué, l'enseignant peut recommencer).
 *  2. Fichiers orphelins : présents dans le Blob, absents de la base, et
 *     âgés d'au moins 24 h → supprimés (sinon ils consomment du quota à vide).
 *     Ce passage ne coûte qu'UNE opération de list() par centre : la base de
 *     comparaison vient des chemins en base, sans head() par document.
 *  3. Lignes « pret » dont le fichier a disparu → retirées. Ce contrôle est
 *     manuel uniquement (`?verifier=1`) : le faire chaque jour coûterait une
 *     opération Blob par document et par jour, et viderait le quota du plan
 *     gratuit. La route de contenu répond déjà 410 si le fichier manque.
 *
 * Le passage orphelins est entièrement sauté si une seule vérification a échoué
 * pour ce centre : un fichier dont on n'a pas pu prouver l'absence de ligne ne
 * doit jamais être supprimé sur la base d'une erreur transitoire.
 *
 * Rien n'est jamais supprimé avant l'âge de sécurité : un upload légitime en
 * cours n'est pas touché. La ligne n'est jamais validée automatiquement : seule
 * la route /finalize, qui contrôle taille et magic bytes, autorise « pret ».
 */

const PENDING_MAX_AGE_MINUTES = 60;
const ORPHAN_MIN_AGE_MINUTES = 60 * 24;
const SCAN_LIMIT = 2000;

type CenterReport = {
  centerId: string;
  pendingRowsDeleted: number;
  brokenRowsDeleted: number;
  orphanBlobsDeleted: number;
  errors: number;
};

async function cleanupCenter(centerId: string, now: number, deepVerify: boolean): Promise<CenterReport> {
  const report: CenterReport = {
    centerId,
    pendingRowsDeleted: 0,
    brokenRowsDeleted: 0,
    orphanBlobsDeleted: 0,
    errors: 0,
  };

  // 1) Dépôts « en_attente » : le fichier n'est jamais arrivé.
  const stalePending = await prisma.seanceDocument.findMany({
    where: {
      centerId,
      statut: { not: "pret" },
      createdAt: { lt: new Date(now - PENDING_MAX_AGE_MINUTES * 60 * 1000) },
    },
    select: { id: true, pathname: true },
    take: 500,
  });

  for (const row of stalePending) {
    try {
      if (await headDocument(row.pathname)) {
        // Fichier bien présent mais finalisation jamais faite (navigateur
        // fermé) : on ne valide pas sans contrôle, la ligne reste en attente.
        logger.warn("Support déposé non finalisé, laissé en attente", { documentId: row.id, centerId });
        continue;
      }
      await prisma.seanceDocument.delete({ where: { id: row.id } });
      report.pendingRowsDeleted++;
    } catch (err) {
      report.errors++;
      logger.error("Nettoyage d'un dépôt en attente impossible", { documentId: row.id, centerId, error: err });
    }
  }

  // 2) Base de référence des orphelins.
  //
  // COÛT : on ne fait PAS un head() par document et par jour. Chaque head()
  // consomme une opération Blob ; un balayage quotidien de tous les documents
  // ferait exploser le quota d'opérations du plan gratuit (10 000/mois) pour
  // rien. Or, pour savoir si un fichier est orphelin, il suffit de comparer la
  // liste des fichiers présents aux CHEMINS DÉCLARÉS EN BASE : aucune vérification
  // de stockage n'est nécessaire pour ça.
  //
  // La preuve d'existence (head) n'est faite que pour les dépôts abandonnés (1),
  // et, en audit manuel (`?verifier=1`), pour purger les lignes mortes.
  const rows = await prisma.seanceDocument.findMany({
    where: { centerId },
    select: { id: true, pathname: true, statut: true },
  });

  const known = new Set(rows.map((row) => row.pathname));
  // Fichiers dont l'existence n'a PAS pu être établie (erreur réseau/API).
  // Ils ne doivent jamais être considérés comme orphelins.
  const unverified = new Set<string>();

  // Audit profond : on prouve l'existence de chaque fichier. Réservé à une
  // demande manuelle, jamais au cron quotidien.
  if (deepVerify) {
    for (const row of rows) {
      try {
        if (!(await headDocument(row.pathname)) && row.statut === "pret") {
          // Ligne « pret » dont le fichier a disparu : on la retire (la route de
          // contenu répond déjà 410, autant ne pas garder de ligne morte).
          await prisma.seanceDocument.delete({ where: { id: row.id } });
          known.delete(row.pathname);
          report.brokenRowsDeleted++;
        }
      } catch (err) {
        report.errors++;
        unverified.add(row.pathname);
        logger.error("Vérification d'un support impossible", { documentId: row.id, centerId, error: err });
      }
    }
  }

  // 3) Fichiers présents dans le stockage mais sans ligne en base.
  // SÉCURITÉ : dès qu'une seule vérification a échoué, le stockage est instable
  // et l'on renonce entièrement à supprimer des orphelins. Une erreur
  // transitoire ne doit jamais coûter un fichier réel.
  if (report.errors > 0) {
    logger.warn("Nettoyage des orphelins ignoré : vérifications de stockage en échec", {
      centerId,
      errors: report.errors,
      unverified: unverified.size,
    });
    return report;
  }

  const blobs = await listBlobsUnder(`${centerId}/seances/`, SCAN_LIMIT);
  for (const blob of blobs) {
    if (known.has(blob.pathname)) continue;
    if (unverified.has(blob.pathname)) continue;
    const ageMinutes = (now - blob.uploadedAt.getTime()) / 60000;
    if (ageMinutes < ORPHAN_MIN_AGE_MINUTES) continue;
    try {
      await deleteDocumentBlob(blob.pathname);
      report.orphanBlobsDeleted++;
    } catch (err) {
      report.errors++;
      logger.error("Suppression d'un fichier orphelin impossible", {
        pathname: blob.pathname,
        centerId,
        error: err,
      });
    }
  }

  return report;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = secret ? authHeader === `Bearer ${secret}` : false;

  let isSuperAdmin = false;
  if (!isCron) {
    const session = await getServerSession(authOptions);
    isSuperAdmin = !!session?.user && (session.user as any).role === "super_admin";
  }

  if (!isCron && !isSuperAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!isBlobStoreConfigured()) {
    return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
  }

  const requested = request.nextUrl.searchParams.get("centerId");
  // Audit profond manuel : prouve l'existence de chaque fichier (1 opération
  // Blob par document). Réservé à une demande ponctuelle, jamais au cron.
  const deepVerify = request.nextUrl.searchParams.get("verifier") === "1";
  const now = Date.now();
  const reports: CenterReport[] = [];

  try {
    const centers = requested
      ? await prisma.center.findMany({ where: { id: requested }, select: { id: true } })
      : await prisma.center.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });

    if (centers.length === 0) {
      return NextResponse.json(
        { error: requested ? "Centre inconnu" : "Aucun centre" },
        { status: 404 }
      );
    }

    for (const center of centers) {
      try {
        reports.push(await cleanupCenter(center.id, now, deepVerify));
      } catch (err) {
        // Isolation : l'échec d'un centre n'empêche pas les suivants.
        logger.error("Nettoyage des supports impossible pour un centre", { centerId: center.id, error: err });
        reports.push({ centerId: center.id, pendingRowsDeleted: 0, brokenRowsDeleted: 0, orphanBlobsDeleted: 0, errors: 1 });
      }
    }

    const totals = reports.reduce(
      (acc, r) => ({
        pendingRowsDeleted: acc.pendingRowsDeleted + r.pendingRowsDeleted,
        brokenRowsDeleted: acc.brokenRowsDeleted + r.brokenRowsDeleted,
        orphanBlobsDeleted: acc.orphanBlobsDeleted + r.orphanBlobsDeleted,
        errors: acc.errors + r.errors,
      }),
      { pendingRowsDeleted: 0, brokenRowsDeleted: 0, orphanBlobsDeleted: 0, errors: 0 }
    );

    logger.info("Nettoyage des supports de séance terminé", { centers: reports.length, ...totals });
    return NextResponse.json({ success: true, ...totals, centers: reports, runAt: new Date().toISOString() });
  } catch (error) {
    logger.error("Erreur lors du nettoyage des supports de séance", { error });
    return NextResponse.json({ error: "Erreur lors du nettoyage" }, { status: 500 });
  }
}
