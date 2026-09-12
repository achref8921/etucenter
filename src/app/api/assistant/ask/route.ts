import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES, PROF_ROLES } from "@/lib/auth-helpers";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { answer } from "@/lib/assistant/service";
import type { HistoryTurn } from "@/lib/assistant/llm";
import { llmEnabled } from "@/lib/assistant/llm";

export const runtime = "nodejs";

interface HistItem {
  role?: unknown;
  text?: unknown;
}

function sanitizeHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryTurn[] = [];
  for (const item of raw.slice(-8)) {
    if (!item || typeof item !== "object") continue;
    const h = item as HistItem;
    if ((h.role === "user" || h.role === "bot") && typeof h.text === "string") {
      const text = h.text.trim().slice(0, 500);
      if (text) out.push({ role: h.role, text });
    }
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const { session, error } = await requireActiveCenter("GET", [...ADMIN_ROLES, ...PROF_ROLES]);
    if (error) return error;

    const user = session!.user as any;
    const role: "admin" | "prof" = user.role === "prof" ? "prof" : "admin";

    const { message, history } = (await request.json()) as { message?: string; history?: unknown };

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

    const llmLimitMax = Number(process.env.ASSISTANT_LLM_RATE_LIMIT || 10);
    const llmQuota = llmEnabled()
      ? rateLimit(getRateLimitKey(request, "assistant-llm"), {
          windowMs: 60 * 1000,
          max: Number.isFinite(llmLimitMax) && llmLimitMax > 0 ? llmLimitMax : 10,
        })
      : { allowed: false as const };

    const result = await answer(role, user.id, user.centerId, message.trim(), {
      history: sanitizeHistory(history),
      useLlm: llmQuota.allowed,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/assistant] erreur:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}