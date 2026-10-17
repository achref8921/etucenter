"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 20;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface SeanceDocumentItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  statut: string;
  createdAt: string;
  uploadedBy?: { id: string; nom: string; prenom: string } | null;
  canDelete?: boolean;
}

interface Limits {
  maxFiles: number;
  remaining: number;
}

interface SeanceDocumentsModalProps {
  seanceId: string;
  seanceLabel: string;
  role: "prof" | "eleve";
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

/**
 * Compression côté client : uniquement si l'image dépasse la limite, pour ne
 * pas dégrader un fichier déjà léger. Le type final reste celui validé par le
 * serveur (contrôlé par magic bytes à la finalisation).
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_IMAGE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), type, 0.85)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Envoi direct du fichier dans le stockage objet (B2) via l'URL présignée.
 * On utilise XMLHttpRequest plutôt que fetch pour disposer de la progression.
 */
function putToStorage(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Envoi impossible (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Envoi impossible : connexion interrompue"));
    xhr.send(file);
  });
}

export default function SeanceDocumentsModal({
  seanceId,
  seanceLabel,
  role,
  onClose,
}: SeanceDocumentsModalProps) {
  const [documents, setDocuments] = useState<SeanceDocumentItem[]>([]);
  const [limits, setLimits] = useState<Limits>({ maxFiles: MAX_FILES, remaining: MAX_FILES });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const base = `/api/prof/seances/${seanceId}/documents`;
  const listUrl = role === "prof" ? base : `/api/eleve/seances/${seanceId}/documents`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(listUrl, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Chargement impossible");
      setDocuments(Array.isArray(body.documents) ? body.documents : []);
      if (body.limits) {
        setLimits({ maxFiles: body.limits.maxFiles, remaining: body.limits.remaining });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);

    if (!ALLOWED.includes(file.type)) {
      setError("Format non accepté : PDF, JPEG, PNG ou WEBP uniquement.");
      return;
    }
    const limit = file.type === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit && !isImage(file.type)) {
      setError(`Fichier trop volumineux : ${formatBytes(limit)} maximum.`);
      return;
    }
    if (limits.remaining <= 0) {
      setError(`Maximum ${MAX_FILES} supports par séance.`);
      return;
    }

    const payload = isImage(file.type) ? await compressImageIfNeeded(file) : file;
    const desc = description.trim() || null;

    let documentId: string | null = null;
    try {
      // 1) Le serveur enregistre la ligne et IMPOSE le chemin de stockage.
      const create = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: payload.name,
          mimeType: payload.type,
          sizeBytes: payload.size,
          description: desc,
        }),
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok) throw new Error(created.error || "Enregistrement impossible");
      const newId: string = created.documentId;
      documentId = newId;

      // 2) Envoi direct dans B2 via une URL présignée, limitée à CE chemin.
      setProgress({ name: payload.name, percent: 0 });
      const presignRes = await fetch(`${base}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: newId }),
      });
      const presign = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok || !presign.url) {
        throw new Error(presign.error || "Préparation de l'envoi impossible");
      }
      await putToStorage(presign.url, payload, payload.type, (percent) =>
        setProgress({ name: payload.name, percent })
      );

      // 3) Finalisation : contrôle réel (taille + magic bytes) côté serveur.
      setProgress({ name: payload.name, percent: 100 });
      const finalize = await fetch(`${base}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: newId }),
      });
      const final = await finalize.json().catch(() => ({}));
      if (!finalize.ok) throw new Error(final.error || "Vérification du fichier impossible");

      setSuccess("Support ajouté");
      setDescription("");
      await load();
    } catch (err) {
      // Dépôt interrompu : on ne laisse ni ligne ni fichier fantôme.
      if (documentId) {
        await fetch(`${base}/${documentId}`, { method: "DELETE" }).catch(() => undefined);
        await load();
      }
      setError(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: SeanceDocumentItem) => {
    if (!window.confirm(`Supprimer définitivement « ${doc.fileName} » ?`)) return;
    setDeletingId(doc.id);
    setError(null);
    try {
      const res = await fetch(`${base}/${doc.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Suppression impossible");
      setSuccess("Support supprimé");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setDeletingId(null);
    }
  };

  const ready = documents.filter((d) => d.statut === "pret");
  const pending = documents.filter((d) => d.statut !== "pret");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Supports de la séance du ${seanceLabel}`}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-[#181b22]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-[#2a2d35]">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Paperclip className="h-4 w-4" /> Supports de la séance
            </h3>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{seanceLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-slate-700 dark:hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <>
              {error && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </p>
              )}
              {success && (
                <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-[12px] text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  {success}
                </p>
              )}

              {pending.length > 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {pending.length} dépôt(s) non confirmé(s) — l'envoi a été interrompu. Supprimez-les
                  pour les retirer.
                </p>
              )}

              {ready.length === 0 && pending.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Aucun support pour cette séance.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-slate-700">
                  {[...ready, ...pending].map((doc) => {
                    const href = `/api/seance-documents/${doc.id}/content`;
                    return (
                      <li key={doc.id} className="flex items-center gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-slate-700 dark:text-slate-300">
                          {isImage(doc.mimeType) ? (
                            <ImageIcon className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                          >
                            {doc.fileName}
                          </a>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {formatBytes(doc.sizeBytes)} · {formatDateTime(doc.createdAt)}
                            {doc.uploadedBy ? ` · ${doc.uploadedBy.prenom} ${doc.uploadedBy.nom}` : ""}
                            {doc.statut !== "pret" ? " · dépôt non confirmé" : ""}
                          </p>
                          {doc.description && (
                            <p className="mt-0.5 truncate text-[12px] text-neutral-600 dark:text-neutral-300">
                              {doc.description}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <a
                            href={`${href}?telecharger=1`}
                            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-slate-700 dark:hover:text-neutral-200"
                            aria-label={`Télécharger ${doc.fileName}`}
                            title="Télécharger"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          {role === "prof" && doc.canDelete && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(doc)}
                              disabled={deletingId === doc.id}
                              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                              aria-label={`Supprimer ${doc.fileName}`}
                              title="Supprimer"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {role === "prof" && (
          <div className="border-t border-neutral-200 px-5 py-4 dark:border-[#2a2d35]">
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (facultatif)"
              maxLength={500}
              className="mb-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-neutral-100"
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={!!progress || limits.remaining <= 0}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Ajouter un support
              </button>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                PDF ≤ 15 Mo · images ≤ 8 Mo · {limits.remaining}/{limits.maxFiles} restants
              </span>
            </div>
            {progress && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span className="truncate">{progress.name}</span>
                  <span>{Math.round(progress.percent)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
