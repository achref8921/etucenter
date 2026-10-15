import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import {
  authorizeDocumentAccess,
  isPreviewableMime,
  loadDocUser,
} from "@/lib/seance-documents";
import {
  BlobMissingError,
  BlobNotConfiguredError,
  isBlobStoreConfigured,
  openDocumentStream,
} from "@/lib/seance-documents-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/seance-documents/[id]/content
 *
 * Sert le contenu d'un support APRÈS contrôle d'accès complet
 * (document → séance → groupe → centre + rôle). L'URL permanente du blob
 * n'est jamais renvoyée : le client ne voit que cette route.
 *
 * La route est volontairement hors préfixe /api/prof et /api/eleve afin que
 * l'autorisation soit faite ici, et non par le middleware.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Aucun rôle imposé ici : l'autorisation fine est faite plus bas.
    const { session, error } = await requireActiveCenter("GET");
    if (error) return error;

    const user = await loadDocUser((session.user as any).id, false);
    if (!user) {
      return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 401 });
    }

    const { id } = await params;
    const scope = await authorizeDocumentAccess(user, id);
    if (!scope.ok) return scope.response;

    const document = scope.document;

    if (document.statut !== "pret") {
      return NextResponse.json(
        { error: "Le dépôt de ce support n'a pas abouti", statut: document.statut },
        { status: 409 }
      );
    }

    if (!isBlobStoreConfigured()) {
      logger.error("Vercel Blob non configuré : BLOB_READ_WRITE_TOKEN ou BLOB_STORE_ID manquant");
      return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
    }

    let opened;
    try {
      opened = await openDocumentStream(document.pathname);
    } catch (err) {
      if (err instanceof BlobMissingError) {
        // Métadonnées présentes mais fichier absent : la ligne est signalée
        // comme cassée (le cron la nettoiera), on ne dérive pas l'URL.
        return NextResponse.json({ error: "Fichier indisponible" }, { status: 410 });
      }
      if (err instanceof BlobNotConfiguredError) {
        return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
      }
      throw err;
    }

    // On impose le Content-Type validé en base, jamais celui renvoyé par Blob.
    const contentType = document.mimeType;
    const inline = isPreviewableMime(contentType);
    const disposition = request.nextUrl.searchParams.get("telecharger") === "1" || !inline
      ? "attachment"
      : "inline";

    const asciiName = document.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

    return new NextResponse(opened.stream as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(document.sizeBytes),
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store, max-age=0",
        "Accept-Ranges": "none",
      },
    });
  } catch (err) {
    logger.error("Erreur lors de la lecture d'un support", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
