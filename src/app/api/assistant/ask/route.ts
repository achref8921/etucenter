import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES, PROF_ROLES } from "@/lib/auth-helpers";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { answer } from "@/lib/assistant/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { session, error } = await requireActiveCenter("GET", [...ADMIN_ROLES, ...PROF_ROLES]);
    if (error) return error;

    const user = session!.user as any;
    const role: "admin" | "prof" = user.role === "prof" ? "prof" : "admin";

    const { message } = (await request.json()) as { message?: string };

    if (!message || typeof message !== "string" || message.trim().length > 500) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    const limit = rateLimit(getRateLimitKey(request, "assistant"), {
      windowMs: 60 * 1000,
      max: 30,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Trop de demandes, patientez un instant." },
        { status: 429 }
      );
    }

    const result = await answer(role, user.id, user.centerId, message.trim());

    if (!result.ok) {
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/assistant] erreur:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}