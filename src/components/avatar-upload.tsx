"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { MAX_IMAGE_DATA_URL_LENGTH } from "@/lib/utils";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const OUTPUT_QUALITY = 0.75;

interface AvatarUploadProps {
  currentImage: string | null;
  endpoint: string;
  extraFields?: Record<string, unknown>;
  onUpdated: (image: string | null) => void;
  size?: "md" | "lg" | "xl";
  label?: string;
}

function cropToSquare(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );
  return canvas.toDataURL("image/jpeg", OUTPUT_QUALITY);
}

const DIM = {
  md: "h-20 w-20",
  lg: "h-28 w-28",
  xl: "h-32 w-32",
} as const;

export default function AvatarUpload({
  currentImage,
  endpoint,
  extraFields,
  onUpdated,
  size = "xl",
  label = "Photo de profil",
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImage);

  useEffect(() => {
    setPreview(currentImage);
  }, [currentImage]);

  const send = async (image: string | null) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(extraFields || {}), image }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors de l'enregistrement");
      }
      setPreview(image);
      onUpdated(image);
      setSuccess(image ? "Photo mise à jour" : "Photo supprimée");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSuccess(null);

    if (!file.type.startsWith("image/")) {
      setError("Veuillez choisir une image");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image trop lourde (max 8 Mo)");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setError("Lecture du fichier impossible");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setError("Image invalide ou corrompue");
      img.onload = () => {
        let dataUrl: string;
        try {
          dataUrl = cropToSquare(img);
        } catch {
          setError("Traitement de l'image impossible");
          return;
        }
        if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
          setError("Image trop lourde après traitement");
          return;
        }
        void send(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={label}
        className={`group relative flex ${DIM[size]} items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-blue-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-8 w-8 text-gray-400 transition-colors group-hover:text-blue-500 dark:text-slate-500" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
          </span>
        )}
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          {preview ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => void send(null)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        )}
      </div>

      <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
        JPG, PNG ou WebP — 8 Mo max. Recadrée automatiquement en carré.
      </p>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
    </div>
  );
}
