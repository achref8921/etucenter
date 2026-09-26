import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { isValidImageDataUrl, MAX_IMAGE_URL_LENGTH } from "@/lib/utils";

const MIME: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "image/avif": "image/avif",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6 && buffer.subarray(0, 3).toString("latin1") === "GIF") {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp") {
    return "image/avif";
  }
  return null;
}

function isExternalImageUrl(value: string): boolean {
  if (value.length > MAX_IMAGE_URL_LENGTH) return false;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET");
    if (error) return error;

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const target = await prisma.utilisateur.findUnique({
      where: { id },
      select: { image: true, centerId: true, deletedAt: true, updatedAt: true },
    });

    if (!target || target.deletedAt || !target.image) {
      return NextResponse.json({ error: "Image introuvable" }, { status: 404 });
    }

    const viewerId = (session!.user as any).id as string;
    const viewerRole = (session!.user as any).role as string;
    const isSelf = viewerId === id;
    const isSuperAdmin = viewerRole === "super_admin";
    const sameCenter = target.centerId === (session!.user as any).centerId;

    if (!isSelf && !isSuperAdmin && !sameCenter) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const stored = target.image.trim();

    if (isExternalImageUrl(stored)) {
      return new Response(null, {
        status: 302,
        headers: { Location: stored, "Cache-Control": "private, no-cache" },
      }) as unknown as NextResponse;
    }

    if (!isValidImageDataUrl(stored)) {
      return NextResponse.json({ error: "Format non supporté" }, { status: 415 });
    }

    const comma = stored.indexOf(",");
    const declared = (stored.slice(5, comma).split(";")[0] || "").toLowerCase();
    if (!MIME[declared]) {
      return NextResponse.json({ error: "Format non supporté" }, { status: 415 });
    }

    const buffer = Buffer.from(stored.slice(comma + 1), "base64");
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Image invalide" }, { status: 400 });
    }

    const sniffed = sniffMime(buffer);
    if (!sniffed) {
      return NextResponse.json({ error: "Image invalide" }, { status: 400 });
    }

    const etag = `W/"u-${id}-${target.updatedAt.getTime()}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "private, no-cache" },
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": sniffed,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
        ETag: etag,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
