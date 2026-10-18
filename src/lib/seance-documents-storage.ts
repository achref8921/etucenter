import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/lib/logger";

/**
 * Stockage objet S3-compatible (Backblaze B2) pour les supports de séance.
 *
 *   - egress GRATUIT chez B2, 10 Go de stockage gratuit : le coût reste nul à
 *     l'échelle d'un centre tant qu'on reste sous le quota ;
 *   - l'URL permanente de l'objet n'est jamais renvoyée telle quelle : le
 *     client ne reçoit que des URLs PRÉSIGNÉES à durée courte ;
 *   - le bucket est PRIVÉ : tout accès passe par une signature.
 *
 * Variables d'environnement requises :
 *   B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT, B2_REGION
 */

let cachedClient: S3Client | null = null;

function readConfig() {
  return {
    keyId: process.env.B2_KEY_ID,
    appKey: process.env.B2_APPLICATION_KEY,
    bucket: process.env.B2_BUCKET,
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION || "us-west-004",
  };
}

export function isBlobStoreConfigured(): boolean {
  const { keyId, appKey, bucket, endpoint } = readConfig();
  return Boolean(keyId && appKey && bucket && endpoint);
}

export class BlobNotConfiguredError extends Error {
  constructor() {
    super("Stockage objet non configuré");
    this.name = "BlobNotConfiguredError";
  }
}

export class BlobMissingError extends Error {
  constructor() {
    super("Fichier introuvable dans le stockage");
    this.name = "BlobMissingError";
  }
}

function requireBucket(): string {
  const { bucket } = readConfig();
  if (!bucket) throw new BlobNotConfiguredError();
  return bucket;
}

function requireStore(): void {
  if (!isBlobStoreConfigured()) throw new BlobNotConfiguredError();
}

function getClient(): S3Client {
  requireStore();
  if (!cachedClient) {
    const { keyId, appKey, endpoint, region } = readConfig();
    cachedClient = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId: keyId!, secretAccessKey: appKey! },
      // B2 expose l'API S3 en style « path » : s3.<region>.backblazeb2.com/<bucket>/<clé>
      forcePathStyle: true,
    });
  }
  return cachedClient;
}

function isNotFound(err: unknown): boolean {
  const e = err as any;
  return (
    e?.name === "NotFound" ||
    e?.name === "NoSuchKey" ||
    e?.name === "NoSuchBucket" ||
    e?.$metadata?.httpStatusCode === 404
  );
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
    const res = await getClient().send(
      new HeadObjectCommand({ Bucket: requireBucket(), Key: pathname })
    );
    return {
      size: typeof res.ContentLength === "number" ? res.ContentLength : 0,
      contentType: res.ContentType || "application/octet-stream",
      uploadedAt: res.LastModified ? new Date(res.LastModified) : new Date(),
      etag: (res.ETag || "").replace(/"/g, ""),
    };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Lit les premiers octets (contrôle des magic bytes). */
export async function readDocumentHead(pathname: string, bytes = 12): Promise<Uint8Array> {
  requireStore();
  let res;
  try {
    res = await getClient().send(
      new GetObjectCommand({
        Bucket: requireBucket(),
        Key: pathname,
        Range: `bytes=0-${Math.max(0, bytes - 1)}`,
      })
    );
  } catch (err) {
    if (isNotFound(err)) throw new BlobMissingError();
    throw err;
  }
  if (!res.Body) throw new BlobMissingError();

  const web = (res.Body as any).transformToWebStream() as ReadableStream<Uint8Array>;
  const reader = web.getReader();
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

export async function deleteDocumentBlob(pathname: string): Promise<void> {
  requireStore();
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: requireBucket(), Key: pathname })
    );
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }
}

export interface ListedBlob {
  pathname: string;
  size: number;
  uploadedAt: Date;
}

/** Liste les objets d'un préfixe (nettoyage des orphelins). */
export async function listBlobsUnder(prefix: string, limit = 1000): Promise<ListedBlob[]> {
  requireStore();
  const out: ListedBlob[] = [];
  let token: string | undefined;
  for (let page = 0; page < 20 && out.length < limit; page++) {
    const res = await getClient().send(
      new ListObjectsV2Command({
        Bucket: requireBucket(),
        Prefix: prefix,
        MaxKeys: Math.min(1000, limit - out.length),
        ContinuationToken: token,
      })
    );
    for (const blob of res.Contents ?? []) {
      if (!blob.Key) continue;
      out.push({
        pathname: blob.Key,
        size: typeof blob.Size === "number" ? blob.Size : 0,
        uploadedAt: blob.LastModified ? new Date(blob.LastModified) : new Date(0),
      });
    }
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
    if (!token) break;
  }
  return out;
}

/**
 * URL présignée d'ENVOI (PUT) : le navigateur dépose directement l'objet dans
 * B2, sans passer par une fonction Vercel (pas de limite de 4,5 Mo et pas de
 * data transfer facturé côté Vercel).
 */
export async function createPresignedPutUrl(
  pathname: string,
  contentType: string,
  expiresIn = 600
): Promise<string> {
  requireStore();
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: requireBucket(), Key: pathname, ContentType: contentType }),
    { expiresIn }
  );
}

/**
 * URL présignée de LECTURE (GET) à durée courte. On y grave le type et le nom
 * de fichier afin que le navigateur reçoive les bons en-têtes (aperçu inline
 * ou téléchargement) sans exposer d'URL permanente.
 */
export async function createPresignedGetUrl(
  pathname: string,
  options: { expiresIn?: number; responseContentType?: string; responseContentDisposition?: string } = {}
): Promise<string> {
  requireStore();
  const { expiresIn = 300, responseContentType, responseContentDisposition } = options;
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: requireBucket(),
      Key: pathname,
      ResponseContentType: responseContentType,
      ResponseContentDisposition: responseContentDisposition,
    }),
    { expiresIn }
  );
}

export function logBlobError(context: string, err: unknown): void {
  logger.error(`Stockage objet: ${context}`, { error: err });
}

export interface BlobStreamResult {
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  contentRange: string | null;
}

/**
 * Lit un objet et renvoie son FLUX (sans présigner d'URL).
 *
 * Utilisé pour les ÉLÈVES : les octets transitent par la route de contenu
 * (même origine) au lieu d'être exposés via une URL signée B2. Trois raisons :
 *   - l'URL du fichier n'existe plus côté navigateur (rien à copier/partager) ;
 *   - le CORS de B2 ne concerne que l'envoi (PUT) : un GET direct depuis le
 *     navigateur est refusé, donc pdf.js ne pourrait pas lire les octets ;
 *   - le lecteur PDF (pdf.js, rendu en canvas) fonctionne aussi sur mobile,
 *     là où un <iframe> PDF n'est pas rendu.
 *
 * `range` est transmis tel quel à B2 pour permettre la lecture partielle.
 */
export async function getObjectStream(
  pathname: string,
  range?: string | null
): Promise<BlobStreamResult> {
  requireStore();
  let res;
  try {
    res = await getClient().send(
      new GetObjectCommand({
        Bucket: requireBucket(),
        Key: pathname,
        Range: range || undefined,
      })
    );
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404 || status === 416) throw new BlobMissingError();
    throw err;
  }

  const raw = res.Body as unknown as {
    transformToWebStream?: () => ReadableStream<Uint8Array>;
  } | null;
  if (!raw) throw new BlobMissingError();

  let body: ReadableStream<Uint8Array>;
  if (typeof raw.transformToWebStream === "function") {
    body = raw.transformToWebStream();
  } else {
    const { Readable } = await import("node:stream");
    body = Readable.toWeb(raw as unknown as InstanceType<typeof Readable>) as unknown as ReadableStream<Uint8Array>;
  }

  return {
    body,
    contentLength: typeof res.ContentLength === "number" ? res.ContentLength : null,
    contentRange: res.ContentRange ?? null,
  };
}