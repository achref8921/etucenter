"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minus, Plus, ShieldAlert, X } from "lucide-react";

/**
 * Visualiseur protégé des supports côté élève.
 *
 * Rendu : les pages (PDF) et les images sont peintes dans un <canvas>, jamais
 * dans un <iframe> ni un <img> : cela fonctionne sur mobile (où un PDF dans un
 * <iframe> ne s'affiche pas) et supprime « Enregistrer l'image sous » / le
 * glisser-déposer. Les octets viennent de la route de contenu (même origine),
 * donc aucune URL de stockage n'est exposée au navigateur.
 *
 * Dissuasion : filigrane mosaïque (nom de l'élève + horodatage), clic droit /
 * sélection / glisser / impression / Ctrl+S-P-U bloqués, et — sur les
 * navigateurs qui le permettent — passage en plein écran avec verrouillage du
 * clavier (Keyboard Lock API) pour capter la touche Impr. écran.
 *
 * Limite honnête : aucun site ne peut empêcher une capture faite par le
 * système d'exploitation ou un appareil photo. Le filigrane rend toute fuite
 * traçable ; c'est la vraie protection.
 */
interface ProtectedDocumentViewerProps {
  documentId: string;
  fileName: string;
  mimeType: string;
  onClose: () => void;
}

const MAX_PAGES = 80;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const SLICE_BYTES = 2 * 1024 * 1024;

/**
 * Télécharge le document par tranches (Range) puis l'assemble en mémoire.
 *
 * Indispensable : un corps de réponse Vercel est plafonné (4,5 Mo) alors que les
 * dépôts vont jusqu'à 15 Mo, et la route plafonne volontairement chaque tranche.
 * On tient donc TOUJOURS le document entier avant de l'afficher : un rendu sur
 * une réponse tronquée produirait un PDF illisible, et aucune URL de stockage
 * n'existe côté navigateur.
 */
async function downloadInSlices(
  url: string,
  slice: number,
  onProgress?: (percent: number | null) => void
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let total: number | null = null;
  const guard = 64 * 1024 * 1024;

  while (offset < guard) {
    const res = await fetch(url, {
      headers: { Range: `bytes=${offset}-${offset + slice - 1}` },
      cache: "no-store",
    });
    if (res.status !== 200 && res.status !== 206) {
      throw new Error(`Téléchargement impossible (${res.status})`);
    }

    const match = /\/(\d+)\s*$/.exec(res.headers.get("Content-Range") || "");
    if (match) total = Number(match[1]);

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) break;
    chunks.push(new Uint8Array(buffer));
    offset += buffer.byteLength;
    onProgress?.(total ? Math.min(100, Math.round((offset / total) * 100)) : null);

    if (res.status === 200 || (total !== null && offset >= total)) break;
  }

  const merged = new Uint8Array(offset);
  let written = 0;
  for (const chunk of chunks) {
    merged.set(chunk, written);
    written += chunk.byteLength;
  }
  return merged;
}

/** Reconstruit une image affichable depuis les octets téléchargés. */
async function toBitmap(bytes: Uint8Array, mimeType: string): Promise<ImageBitmap | HTMLImageElement> {
  const blob = new Blob([bytes as BlobPart], { type: mimeType || "application/octet-stream" });
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* repli ci-dessous (image non décodable par createImageBitmap) */
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = objectUrl;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}

export default function ProtectedDocumentViewer({
  documentId,
  fileName,
  mimeType,
  onClose,
}: ProtectedDocumentViewerProps) {
  const href = `/api/seance-documents/${documentId}/content`;

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageHostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<any>; destroy: () => void } | null>(null);
  const imageRef = useRef<ImageBitmap | HTMLImageElement | null>(null);
  const renderedRef = useRef<Set<number>>(new Set());
  const tokenRef = useRef(0);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [owner, setOwner] = useState("");
  const [stamp, setStamp] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  const isPdfFile = mimeType === "application/pdf";

  // ---- Identité + horodatage du filigrane (traçabilité des captures) ----
  useEffect(() => {
    let alive = true;
    setStamp(
      new Date().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    );
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        const u = body?.user;
        const full = [u?.prenom, u?.nom].filter(Boolean).join(" ").trim();
        setOwner(full || "Élève");
      })
      .catch(() => {
        if (alive) setOwner("Élève");
      });
    return () => {
      alive = false;
    };
  }, []);

  // ---- Verrous : menu contextuel, glisser, sélection, raccourcis, impression ----
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      if (key === "f12" || (e.ctrlKey || e.metaKey) && ["s", "p", "u", "j"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // PrintScreen : on vide la presse-papiers (freine « capture puis coller »).
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => undefined);
      }
    };
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("selectstart", block);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    const style = document.createElement("style");
    style.textContent = "@media print { body > *:not(#protected-doc-print-lock) { display: none !important; } }";
    document.head.appendChild(style);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("selectstart", block);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      style.remove();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // ---- Chargement du document ----
  useEffect(() => {
    let cancelled = false;
    const token = ++tokenRef.current;
    renderedRef.current = new Set();

    (async () => {
      try {
        // Le document est d'abord téléchargé par tranches (le serveur plafonne
        // chaque réponse), puis affiché : le rendu n'est jamais partiel.
        const bytes = await downloadInSlices(href, SLICE_BYTES, setProgress);
        if (cancelled || token !== tokenRef.current) return;

        if (isPdfFile) {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const doc = await pdfjs.getDocument({ data: bytes }).promise;
          if (cancelled || token !== tokenRef.current) {
            void doc.destroy();
            return;
          }
          pdfRef.current = doc as unknown as typeof pdfRef.current;
          setPageCount(doc.numPages);
          pageHostRefs.current = new Array(doc.numPages).fill(null);
        } else {
          const bitmap = await toBitmap(bytes, mimeType);
          if (cancelled || token !== tokenRef.current) return;
          imageRef.current = bitmap;
        }
        setStatus("ready");
        setRenderKey((k) => k + 1);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Affichage impossible");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      pdfRef.current?.destroy();
      pdfRef.current = null;
      imageRef.current = null;
    };
  }, [href, isPdfFile]);

  // ---- Peinture dans les canvas (recalculée au zoom) ----
  useEffect(() => {
    if (status !== "ready") return;    const container = scrollRef.current;
    if (!container) return;
    const token = tokenRef.current;
    renderedRef.current = new Set();
    let observer: IntersectionObserver | null = null;

    const width = () => Math.max(240, (container.clientWidth - 32) * zoom);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const paintImage = async () => {
      const img = imageRef.current;
      const host = pageHostRefs.current[0];
      if (!img || !host) return;
      const naturalWidth = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
      const naturalHeight = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
      const target = Math.min(width(), naturalWidth);
      const scale = target / naturalWidth;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(naturalWidth * scale * dpr);
      canvas.height = Math.round(naturalHeight * scale * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      host.replaceChildren(canvas);
      canvas.className = "mx-auto block h-auto w-full rounded-lg bg-white shadow-lg";
      renderedRef.current.add(0);
    };

    const paintPdfPage = async (index: number) => {
      const doc = pdfRef.current;
      const host = pageHostRefs.current[index];
      if (!doc || !host) return;
      const page = await doc.getPage(index + 1);
      if (token !== tokenRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = width() / base.width;
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (token !== tokenRef.current) return;
      host.style.aspectRatio = "";
      host.replaceChildren(canvas);
      canvas.className = "mx-auto block h-auto w-full rounded-lg bg-white shadow-lg";
      renderedRef.current.add(index);
    };

    if (isPdfFile) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const index = Number((entry.target as HTMLElement).dataset.page);
            if (Number.isNaN(index) || renderedRef.current.has(index)) continue;
            renderedRef.current.add(index);
            void paintPdfPage(index);
          }
        },
        { root: container, rootMargin: "600px 0px" }
      );
      pageHostRefs.current.forEach((host, index) => {
        if (!host) return;
        if (index === 0) void paintPdfPage(0);
        else observer!.observe(host);
      });
    } else {
      void paintImage();
    }

    return () => observer?.disconnect();
  }, [status, isPdfFile, zoom, renderKey]);

  const enableProtection = useCallback(async () => {
    try {
      if (!document.fullscreenElement && rootRef.current?.requestFullscreen) {
        await rootRef.current.requestFullscreen();
      }
      const keyboard = (navigator as Navigator & { keyboard?: { lock?: (codes: string[]) => Promise<void> } }).keyboard;
      if (keyboard?.lock) {
        await keyboard.lock(["PrintScreen"]);
        setLocked(true);
      }
    } catch {
      setLocked(false);
    }
  }, []);

  const label = owner ? `Réservé à ${owner}` : "Réservé";
  const shown = Math.min(pageCount, 80);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Consultation protégée de ${fileName}`}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <p className="flex min-w-0 items-center gap-2 truncate text-[12px] text-white/80">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="truncate">{fileName}</span>
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
            lecture seule
          </span>
          {isPdfFile && pageCount > 0 && (
            <span className="shrink-0 text-[10px] text-white/50">{shown} page(s)</span>
          )}
        </p>
        <div className="flex items-center gap-1">
          {isPdfFile && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Réduire le zoom"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-[11px] text-white/60">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Agrandir le zoom"
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void enableProtection()}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              locked ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
            title="Plein écran + blocage de la touche Impr. écran (navigateur de bureau)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {locked ? "Protection active" : "Mode protégé"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la consultation"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto px-4 py-4">
        {status === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>
              Chargement du document…{progress !== null ? ` ${progress} %` : ""}
            </span>
            {progress !== null && (
              <span className="h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
                <span className="block h-full bg-blue-400 transition-all" style={{ width: `${progress}%` }} />
              </span>
            )}
          </div>
        )}
        {status === "error" && (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            {error ?? "Affichage impossible — réessayez plus tard."}
          </div>
        )}

        <div className={status === "ready" ? "block" : "hidden"}>
          {isPdfFile
            ? Array.from({ length: pageCount }).map((_, index) => (
                <div
                  key={index}
                  data-page={index}
                  ref={(el) => {
                    pageHostRefs.current[index] = el;
                  }}
                  className="mx-auto mb-4 w-full"
                  style={{ aspectRatio: index === 0 ? undefined : "1 / 1.414" }}
                />
              ))
            : (
              <div
                data-page={0}
                ref={(el) => {
                  pageHostRefs.current[0] = el;
                }}
                className="mx-auto flex w-full items-center justify-center"
              />
            )}
        </div>

        {/* Filigrane : identification de toute capture d'écran. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-around">
            {Array.from({ length: 9 }).map((_, row) => (
              <div key={row} className="flex justify-around whitespace-nowrap">
                {Array.from({ length: 2 }).map((__, col) => (
                  <span
                    key={col}
                    className="rotate-[-22deg] text-[13px] font-semibold tracking-wide text-white/[0.13]"
                  >
                    {label} · {stamp}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-22deg] text-2xl font-bold tracking-wider text-white/[0.07] sm:text-4xl">
              {label}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-2 text-center text-[11px] text-white/40">
            Document strictement personnel — capture, copie et rediffusion interdites
          </div>
        </div>
      </div>
      <div id="protected-doc-print-lock" className="hidden" />
    </div>
  );
}
