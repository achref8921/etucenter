import { del, get, head, list } from "@vercel/blob";
import { logger } from "@/lib/logger";

/**
 * Accès Vercel Blob (store Private) pour les supports de séance.
 *
 * Règles :
 *  - l'URL permanente du blob ne doit JAMAIS être renvoyée au client ;
 *    seul le stream passe par la route applicative protégée ;
 *  - le chemin est toujours dérivé de la base (centerId/seanceId), jamais
 *    d'une valeur fournie par le navigateur sans vérification serveur ;
 *  - l'accès se fait soit par jeton read-write, soit par OIDC Vercel avec
 *    BLOB_STORE_ID (préviews/production).
 */

export function isBlobStoreConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

export class BlobNotConfiguredError extends Error {
  constructor() {
    super("Vercel Blob non configuré");
    this.name = "BlobNotConfiguredError";
  }
}

function requireStore(): void {
  if (!isBlobStoreConfigured()) throw new BlobNotConfiguredError();
}

export interface DocumentBlobStream {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
  etag: string;
  uploadedAt: Date;
}

export class BlobMissingError extends Error {
  constructor() {
    super("Fichier introuvable dans le stockage");
    this.name = "BlobMissingError";
  }
}

/** Ouvre un stream privé sur le blob, après revalidation du pathename. */
export async function openDocumentStream(pathname: string): Promise<DocumentBlobStream> {
  requireStore();
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode === 304 || !result.stream) throw new BlobMissingError();
  return {
    stream: result.stream,
    contentType: result.blob.contentType || "application/octet-stream",
    size: result.blob.size,
    etag: result.blob.etag,
    uploadedAt: result.blob.uploadedAt,
  };
}

/** Lit uniquement les premiers octets (contrôle des magic bytes). */
export async function readDocumentHead(pathname: string, bytes = 12): Promise<Uint8Array> {
  requireStore();
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode === 304 || !result.stream) throw new BlobMissingError();

  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < bytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    // Libère la connexion : on ne veut pas télécharger un PDF de 15 Mo pour
    // vérifier 12 octets.
    await reader.cancel().catch(() => undefined);
  }

  const out = new Uint8Array(Math.min(total, bytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= out.length) break;
    const slice = chunk.subarray(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.length;
  }
  return out;
}

export interface DocumentBlobHead {
  size: number;
  contentType: string;
  uploadedAt: Date;
  etag: string;
}

export async function headDocument(pathname: string): Promise<DocumentBlobHead | null> {
  requireStore();
  try {
    const meta = await head(pathname);
    return {
      size: meta.size,
      contentType: meta.contentType || "application/octet-stream",
      uploadedAt: meta.uploadedAt,
      etag: meta.etag,
    };
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.name === "BlobNotFoundError") return null;
    throw err;
  }
}

export async function deleteDocumentBlob(pathname: string): Promise<void> {
  requireStore();
  try {
    await del(pathname);
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.name === "BlobNotFoundError") return;
    throw err;
  }
}

export interface ListedBlob {
  pathname: string;
  size: number;
  uploadedAt: Date;
}

/** Liste les blobs d'un préfixe (nettoyage des orphelins). */
export async function listBlobsUnder(prefix: string, limit = 1000): Promise<ListedBlob[]> {
  requireStore();
  const out: ListedBlob[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20 && out.length < limit; page++) {
    const res = await list({ prefix, limit: Math.min(500, limit - out.length), cursor });
    for (const blob of res.blobs) {
      out.push({ pathname: blob.pathname, size: blob.size, uploadedAt: new Date(blob.uploadedAt) });
    }
    cursor = res.hasMore ? (res as any).cursor : undefined;
    if (!res.hasMore) break;
  }
  return out;
}

export function logBlobError(context: string, err: unknown): void {
  logger.error(`Vercel Blob: ${context}`, { error: err });
}
