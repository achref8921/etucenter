import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { readLinked, readSessionToken, writeSessionToken } from "@/lib/account-switch";
import type { JWT } from "next-auth/jwt";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = await readSessionToken(req);
  const currentId = token?.id;
  if (!token || !currentId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: { targetId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  if (!targetId) {
    return NextResponse.json({ error: "Compte cible manquant" }, { status: 400 });
  }

  const linked = readLinked(token).filter((a) => a.id !== targetId && a.id !== currentId);

  await prisma.systemLog.create({
    data: {
      action: "account_unlinked",
      entity: "utilisateur",
      entityId: targetId,
      userId: currentId,
      details: { removed: targetId },
    },
  });

  logger.info("Compte délié", { from: currentId, removed: targetId });

  const res = NextResponse.json({ linked });
  writeSessionToken(res, { ...(token as JWT), linked });
  return res;
}