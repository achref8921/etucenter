import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import {
  authorizeDocumentAccess,
  isPreviewableMime,
  loadDocUser,
} from "@/lib/seance-documents";
import {
  BlobNotConfiguredError,
  createPresignedGetUrl,
  isBlobStoreConfigured,
} from "@/lib/seance-documents-storage";


/**
 * GET /api/seance-documents/[id]/content
 *
 * Sert le contenu d'un support APRÈS contrôle d'accès complet
 * (document → séance → groupe → centre + rôle). L'accès se fait par
 * REDIRECTION vers une URL présignée à durée courte (5 min) :
 *   - l'URL permanente du fichier n'est jamais exposée ;
 *   - le téléchargement ne transite PAS par Vercel (aucun data transfer
 *     facturé, egress gratuit chez B2) ;
 *   - le nom de fichier et le type sont gravés dans la signature.
 *
 * La route est volontairement hors préfixe /api/prof et /api/eleve afin que
 * l'autorisation soit faite ici, et non par le middleware.
 *
 * ÉLÈVE : la lecture est résolument « lecture seule » — le paramètre
 * ?telecharger=1 est ignoré (jamais de disposition « attachment »), et la
 * redirection est marquée no-store. Le visualiseur côté client (composant
 * protected-document-viewer) ajoute le filigrane et verrouille les
 * raccourcis de sauvegarde / menu contextuel / impression.
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
      logger.error("Stockage objet non configuré : B2_KEY_ID / B2_BUCKET / B2_ENDPOINT manquants");
      return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
    }

    // On impose le Content-Type validé en base, jamais celui renvoyé par le stockage.
    const role = (session.user as any).role;
    const isEleve = role === "eleve";
    // Pour un élève : lecture seule dans le visualiseur protégé.
    //   - ?telecharger=1 est ignoré (pas de disposition "attachment") ;
    //   - même un MIME non prévisualisable reste en inline côté élève.
    const inline = isPreviewableMime(document.mimeType) || isEleve;
    const download = !isEleve && (request.nextUrl.searchParams.get("telecharger") === "1" || !inline);
    const asciiName = document.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\\r\n]/g, "_");

    let url: string;
    try {
      url = await createPresignedGetUrl(document.pathname, {
        expiresIn: 300,
        responseContentType: document.mimeType,
        responseContentDisposition: `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      });
    } catch (err) {
      if (err instanceof BlobNotConfiguredError) {
        return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
      }
      throw err;
    }

    return NextResponse.redirect(url, {
      status: 307,
      headers: isEleve
        ? { "Cache-Control": "no-store, private", Pragma: "no-cache" }
        : undefined,
    });
  } catch (err) {
    logger.error("Erreur lors de la lecture d'un support", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
