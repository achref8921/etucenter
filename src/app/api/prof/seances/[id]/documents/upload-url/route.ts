import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  authorizeSeanceAccess,
  isAllowedMime,
  loadDocUser,
  maxBytesForMime,
  MAX_FILES_PER_SEANCE,
} from "@/lib/seance-documents";
import { createPresignedPutUrl, isBlobStoreConfigured } from "@/lib/seance-documents-storage";


/**
 * POST /api/prof/seances/[id]/documents/upload-url
 *
 * Étape 2/3 : renvoie une URL PRÉSIGNÉE (PUT) limitée au SEUL chemin déjà
 * enregistré en base par le serveur. Le navigateur téléverse alors directement
 * dans Backblaze B2 :
 *   - le chemin n'est jamais fourni par le client (il vient de la base) ;
 *   - le Content-Type est gravé dans la signature ;
 *   - la validité est courte, sans possibilité d'écraser un objet existant.
 *
 * Cette approche évite la limite de corps de 4,5 Mo des fonctions Vercel et ne
 * facture aucun data transfer à Vercel lors de l'envoi.
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

    const documentId = body?.documentId;
    if (typeof documentId !== "string" || !documentId) {
      return NextResponse.json({ error: "documentId manquant" }, { status: 400 });
    }

    // La confiance ne vient que de la base : document de CETTE séance, de CE
    // centre, déposé par CE professeur.
    const document = await prisma.seanceDocument.findFirst({
      where: {
        id: documentId,
        seanceId: scope.seance.id,
        centerId: user.centerId,
        uploadedById: user.id,
      },
      select: { id: true, pathname: true, mimeType: true, statut: true },
    });

    if (!document) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    if (document.statut === "pret") {
      return NextResponse.json({ error: "Support déjà déposé" }, { status: 409 });
    }

    const count = await prisma.seanceDocument.count({ where: { seanceId: scope.seance.id } });
    if (count > MAX_FILES_PER_SEANCE) {
      return NextResponse.json({ error: "Quota de supports atteint" }, { status: 400 });
    }

    if (!isAllowedMime(document.mimeType)) {
      return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 });
    }

    const url = await createPresignedPutUrl(document.pathname, document.mimeType, 600);

    return NextResponse.json({
      url,
      pathname: document.pathname,
      contentType: document.mimeType,
      maxBytes: maxBytesForMime(document.mimeType),
    });
  } catch (err) {
    logger.error("Erreur lors de la génération de l'URL d'envoi", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
