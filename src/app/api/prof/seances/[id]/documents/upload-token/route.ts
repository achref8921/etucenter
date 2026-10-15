import { NextRequest, NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
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
import { isBlobStoreConfigured } from "@/lib/seance-documents-storage";

export const runtime = "nodejs";

/**
 * POST /api/prof/seances/[id]/documents/upload-token
 *
 * Étape 2/3 : Vercel Blob appelle cette route (`handleUploadUrl`) pour obtenir
 * un jeton d'upload. Le jeton n'accorde QUE :
 *   - le chemin exact déjà enregistré en base par le serveur ;
 *   - un type MIME et une taille correspondant à cette ligne ;
 *   - une durée de validité courte.
 *
 * Le client ne peut donc pas.upload ailleurs, ni avec un autre type, ni
 * écraser un blob existant.
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

    const body = await request.json();

    const jsonResponse = await handleUpload({
      request,
      body,
      /**
       * Vercel demande un jeton pour `pathname`, avec le `clientPayload` que le
       * navigateur a fourni. On ne fait confiance qu'à la base.
       */
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const documentId =
          typeof clientPayload === "string"
            ? clientPayload
            : (() => {
                throw new Error("clientPayload manquant");
              })();

        const document = await prisma.seanceDocument.findFirst({
          where: {
            id: documentId,
            seanceId: scope.seance.id,
            centerId: user.centerId,
            uploadedById: user.id,
          },
          select: { id: true, pathname: true, mimeType: true, sizeBytes: true, statut: true },
        });

        // 404 : ce document n'appartient pas à cette séance / ce centre / ce
        // professeur. Aucun jeton n'est délivré.
        if (!document) throw new Error("Document introuvable");
        if (document.statut === "pret") throw new Error("Support déjà déposé");
        if (document.pathname !== pathname) throw new Error("Chemin de dépôt non autorisé");

        const count = await prisma.seanceDocument.count({ where: { seanceId: scope.seance.id } });
        if (count > MAX_FILES_PER_SEANCE) throw new Error("Quota de supports atteint");

        if (!isAllowedMime(document.mimeType)) throw new Error("Type de fichier non autorisé");

        return {
          allowedContentTypes: [document.mimeType],
          maximumSizeInBytes: maxBytesForMime(document.mimeType),
          // Le chemin est imposed par le serveur : pas de suffixe aléatoire
          // ajouté par Vercel, et surtout pas d'écrasement possible.
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60 * 1000,
          cacheControlMaxAge: 0,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Simple journalisation : la confirmation officielle passe par la route
        // de finalisation, qui revalide l'accès et contrôle les magic bytes.
        logger.info("Blob déposé, finalisation attendue", {
          pathname: blob.pathname,
          contentType: blob.contentType,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    logger.error("Erreur lors de la génération du jeton d'upload", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
