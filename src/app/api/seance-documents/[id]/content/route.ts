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
  createPresignedGetUrl,
  getObjectStream,
  isBlobStoreConfigured,
} from "@/lib/seance-documents-storage";

/**
 * Taille maximale servie en une seule réponse pour un élève.
 *
 * Vercel refuse un corps de réponse de fonction au-delà de 4,5 Mo
 * (FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE). Comme les dépôts vont jusqu'à 15 Mo
 * (PDF) et 8 Mo (images), chaque réponse est découpée en tranches d'au plus
 * cette taille, y compris quand le client demande un Range ouvert (`bytes=0-`).
 * Le compteur correct est fourni par l'en-tête Content-Range, ce qui permet à
 * pdf.js (et au fetch découpé du visualiseur) de récupérer le reste.
 */
const MAX_STREAM_BYTES = 4 * 1024 * 1024;


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
 * ÉLÈVE : lecture « même origine » uniquement. Les octets sont STREAMÉS par
 * cette route (jamais d'URL signée renvoyée au navigateur, donc rien à copier
 * ni à partager), ?telecharger=1 est ignoré, et les en-têtes interdisent la
 * mise en cache. Le visualiseur client (protected-document-viewer) rend les
 * pages en canvas via pdf.js — compatible mobile — et ajoute le filigrane.
 *
 * PROF / ADMIN : comportement inchangé (redirection 307 vers une URL
 * présignée de 5 min, disposition inline pour l'aperçu ou attachment pour le
 * téléchargement explicite).
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
    const asciiName = document.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\\r\n]/g, "_");
    const disposition = `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`;

    // ÉLÈVE : les octets transitent par cette route (même origine). L'URL du
    // fichier n'est jamais exposée au navigateur, et le lecteur canvas (pdf.js)
    // peut lire les octets sans dépendre du CORS de B2, y compris sur mobile.
    // Conséquence assumée : la bande passante passe par Vercel, et le dépôt est
    // plafonné à 15 Mo (PDF) / 8 Mo (images) côté téléversement.
    if (isEleve) {
      const size = document.sizeBytes > 0 ? document.sizeBytes : null;
      const parsed = /^bytes=(\d+)-(\d*)$/.exec((request.headers.get("range") || "").trim());

      let start = 0;
      let wantedEnd: number | null = null;
      if (parsed) {
        start = Number(parsed[1]);
        wantedEnd = parsed[2] === "" ? null : Number(parsed[2]);
      }

      if (size !== null && start >= size) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
        });
      }

      // Un corps de réponse Vercel est plafonné : un fichier plus gros n'est
      // JAMAIS servi d'un bloc (une réponse tronquée rendrait le PDF illisible).
      // On invite donc le client à demander des tranches, ce que fait le
      // visualiseur de l'élève. Un fichier assez petit reste servi entier.
      const wholeFits = size !== null && size <= MAX_STREAM_BYTES && !parsed;
      if (size !== null && size > MAX_STREAM_BYTES && !parsed) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store, private",
          },
        });
      }

      const cap = start + MAX_STREAM_BYTES - 1;
      const end = wholeFits
        ? size! - 1
        : Math.min(
            wantedEnd ?? cap,
            cap,
            size !== null ? size - 1 : Number.MAX_SAFE_INTEGER
          );

      let stream;
      try {
        stream = await getObjectStream(
          document.pathname,
          wholeFits ? null : `bytes=${start}-${end}`
        );
      } catch (err) {
        if (err instanceof BlobMissingError) {
          return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
        }
        if (err instanceof BlobNotConfiguredError) {
          return NextResponse.json({ error: "Stockage de fichiers non configuré" }, { status: 503 });
        }
        throw err;
      }

      const headers = new Headers({
        "Content-Type": document.mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
      });
      if (stream.contentLength !== null) headers.set("Content-Length", String(stream.contentLength));

      if (wholeFits) {
        return new Response(stream.body, { status: 200, headers });
      }

      // On réécrit le Content-Range à partir de la taille connue en base : la
      // tranche est notre découpage, pas celui demandé par le client.
      const contentRange =
        size !== null ? `bytes ${start}-${end}/${size}` : stream.contentRange;
      if (contentRange) headers.set("Content-Range", contentRange);

      return new Response(stream.body, { status: 206, headers });
    }

    const inline = isPreviewableMime(document.mimeType);
    const download = request.nextUrl.searchParams.get("telecharger") === "1" || !inline;

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

    return NextResponse.redirect(url, 307);
  } catch (err) {
    logger.error("Erreur lors de la lecture d'un support", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
