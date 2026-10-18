"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, X } from "lucide-react";

/**
 * Visualiseur protégé des supports côté élève.
 *
 * Objectif « consultation uniquement » :
 *   - aucun bouton de téléchargement, aucun nouvel onglet (pas d'URL copiable
 *     depuis la barre d'adresses) ;
 *   - filigrane portant le NOM DE L'ÉLÈVE superposé au document (utile en
 *     cas de capture d'écran propagée) ;
 *   - verrouillage : clic droit, glisser-déposer, sélection de texte,
 *     Ctrl/Cmd+S, Ctrl/Cmd+P, Ctrl/Cmd+U, impression (@media print) ;
 *   - PDF rendu dans une iframe avec la barre d'outils du lecteur masquée
 *     (#toolbar=0).
 *
 * Limite honnête : un navigateur ne peut pas empêcher à 100 % une capture
 * d'écran matérielle/OS ni un enregistrement via les DevTools — ces
 * mesures constituent un fort frein dissuasif, pas une DRM.
 */
interface ProtectedDocumentViewerProps {
  documentId: string;
  fileName: string;
  mimeType: string;
  onClose: () => void;
}

export default function ProtectedDocumentViewer({
  documentId,
  fileName,
  mimeType,
  onClose,
}: ProtectedDocumentViewerProps) {
  const [owner, setOwner] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const href = `/api/seance-documents/${documentId}/content`;
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const body = await res.json().catch(() => null);
        const u = body?.user;
        const full = [u?.prenom, u?.nom].filter(Boolean).join(" ").trim();
        if (alive) setOwner(full || "Élève");
      } catch {
        if (alive) setOwner("Élève");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      if (key === "f12" || (e.ctrlKey || e.metaKey) && ["s", "p", "u", "j"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("selectstart", block);
    window.addEventListener("keydown", onKey, true);
    // Interdiction d'impression tant que le visualiseur est ouvert.
    const style = document.createElement("style");
    style.textContent =
      "@media print { body > *:not(#protected-doc-print-lock) { display: none !important; } }";
    document.head.appendChild(style);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("selectstart", block);
      window.removeEventListener("keydown", onKey, true);
      style.remove();
    };
  }, []);

  const label = owner ? `Réservé à ${owner}` : "Réservé";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Consultation protégée de ${fileName}`}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <p className="flex min-w-0 items-center gap-2 truncate text-[12px] text-white/80">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="truncate">{fileName}</span>
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
            lecture seule
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la consultation"
          className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-auto p-4">
          {failed ? (
            <div className="flex h-full items-center justify-center text-sm text-white/70">
              Affichage impossible — réessayez plus tard.
            </div>
          ) : isPdf ? (
            <iframe
              src={`${href}#toolbar=0&navpanes=0&view=FitH`}
              title={fileName}
              className="h-full w-full rounded-lg border border-white/10 bg-white"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={href}
                alt={fileName}
                draggable={false}
                onError={() => setFailed(true)}
                className="max-h-full max-w-full rounded-lg object-contain"
                style={{ pointerEvents: "none" }}
              />
            </div>
          )}
        </div>

        {/* Filigrane en mosaïque : dissuade la capture d'écran et identifie la fuite. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-around">
            {Array.from({ length: 7 }).map((_, row) => (
              <div key={row} className="flex justify-around whitespace-nowrap">
                {Array.from({ length: 3 }).map((__, col) => (
                  <span
                    key={col}
                    className="rotate-[-22deg] text-[13px] font-semibold tracking-wide text-white/[0.09]"
                  >
                    {label} · {new Date().getFullYear()}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-2 text-center text-[11px] text-white/30">
            Document strictement personnel — toute reproduction est interdite
          </div>
        </div>
      </div>
      <div id="protected-doc-print-lock" className="hidden" />
    </div>
  );
}
