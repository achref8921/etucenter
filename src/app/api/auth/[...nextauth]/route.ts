import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { rateLimit, getRateLimitKey, AUTH_RATE_LIMITS } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

function rateLimitResponse(resetAt: number) {
  return NextResponse.json(
    { error: "Trop de tentatives de connexion. Réessayez plus tard." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
    }
  );
}

async function checkLoginRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = new URL(request.url);

  if (request.method !== "POST" || !pathname.endsWith("/callback/credentials")) {
    return null;
  }

  const ipLimit = rateLimit(getRateLimitKey(request, "login"), AUTH_RATE_LIMITS.login);
  if (!ipLimit.allowed) {
    return rateLimitResponse(ipLimit.resetAt);
  }

  const body = await request.clone().text();
  const params = new URLSearchParams(body);
  const email = params.get("email")?.trim().toLowerCase();

  if (email) {
    const emailLimit = rateLimit(`login:email:${email}`, AUTH_RATE_LIMITS.login);
    if (!emailLimit.allowed) {
      return rateLimitResponse(emailLimit.resetAt);
    }
  }

  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<unknown> }) {
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<unknown> }) {
  const blocked = await checkLoginRateLimit(req);
  if (blocked) return blocked;
  return handler(req, ctx);
}
