import { encode, getToken, type JWT } from "next-auth/jwt";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { LinkedAccount } from "@/types/next-auth";

export const LINKED_ACCOUNTS_MAX = 3;

const SESSION_COOKIE = {
  production: "__Secure-next-auth.session-token",
  development: "next-auth.session-token",
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieName(): string {
  return isProduction() ? SESSION_COOKIE.production : SESSION_COOKIE.development;
}

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? "";
}

/**
 * The linked accounts live inside the signed session JWT, so they are
 * unreachable without NEXTAUTH_SECRET and disappear as soon as the user
 * signs out (the cookie is destroyed).
 */
export async function readSessionToken(req: NextRequest): Promise<JWT | null> {
  if (!secret()) return null;
  try {
    return await getToken({ req, secret: secret() });
  } catch {
    return null;
  }
}

/**
 * Re-signs the session JWT and rewrites the cookie. Any change to the linked
 * accounts (link / unlink / switch) must go through here, otherwise the
 * client keeps the previous token and the change is silently lost.
 */
export function writeSessionToken(res: NextResponse, token: JWT): void {
  const value = encode({ token, secret: secret() });
  res.cookies.set(sessionCookieName(), value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProduction(),
  });
}

export function readLinked(token: JWT | null): LinkedAccount[] {
  if (!token || !Array.isArray(token.linked)) return [];
  return token.linked.filter(
    (a): a is LinkedAccount => !!a && typeof a.id === "string" && typeof a.email === "string"
  );
}

/**
 * Drops every linked account that is the current one or no longer usable, so a
 * deactivated target can never be switched to and the cookie cannot grow
 * without bound.
 */
export async function sanitizeLinked(linked: LinkedAccount[], currentId: string): Promise<LinkedAccount[]> {
  const ids = linked.map((a) => a.id);
  if (ids.length === 0) return [];

  const rows = await prisma.utilisateur.findMany({
    where: { id: { in: ids } },
    select: { id: true, centerId: true, actif: true, ghost: true, deletedAt: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const alive = await prisma.center.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.centerId))] } },
    select: { id: true, active: true },
  });
  const centerActive = new Map(alive.map((c) => [c.id, c.active]));

  return linked.filter((a) => {
    const u = byId.get(a.id);
    if (!u) return false;
    if (a.id === currentId) return false;
    if (u.ghost || u.deletedAt || !u.actif) return false;
    return centerActive.get(u.centerId) === true;
  });
}

export function accountFromRow(row: {
  id: string;
  role: string;
  nom: string;
  prenom: string;
  email: string;
  centerId: string;
}): LinkedAccount {
  return {
    id: row.id,
    role: row.role,
    nom: row.nom,
    prenom: row.prenom,
    email: row.email,
    centerId: row.centerId,
  };
}

export function accountLabel(account: { nom: string; prenom: string; role: string }): string {
  return `${account.prenom} ${account.nom}`;
}