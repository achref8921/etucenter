import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  accountFromRow,
  readLinked,
  readSessionToken,
  sanitizeLinked,
  writeSessionToken,
} from "@/lib/account-switch";
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

  const allowed = await sanitizeLinked(readLinked(token), currentId);
  if (!allowed.some((a) => a.id === targetId)) {
    logger.warn("Bascule refusée : compte non lié", { currentId, targetId });
    return NextResponse.json({ error: "Ce compte n'est pas lié à votre session" }, { status: 403 });
  }

  const rows = await prisma.utilisateur.findMany({
    where: { id: { in: [currentId, targetId] } },
    select: {
      id: true,
      role: true,
      nom: true,
      prenom: true,
      email: true,
      centerId: true,
      image: true,
      actif: true,
      ghost: true,
      deletedAt: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const current = byId.get(currentId);
  const target = byId.get(targetId);

  if (!current || current.ghost || current.deletedAt || !current.actif) {
    return NextResponse.json({ error: "Compte actif indisponible" }, { status: 403 });
  }

  if (!target || target.ghost || target.deletedAt || !target.actif) {
    return NextResponse.json({ error: "Ce compte est désactivé" }, { status: 403 });
  }

  const center = await prisma.center.findUnique({
    where: { id: target.centerId },
    select: { active: true },
  });
  if (!center?.active) {
    return NextResponse.json({ error: "Le centre de ce compte est suspendu" }, { status: 403 });
  }

  // The account we leave becomes a linked target so the user can switch back.
  // The account we enter must be dropped from the list, otherwise the switcher
  // would offer the already-active account and clicking it would fail with 403.
  const linked = [
    ...allowed.filter((a) => a.id !== currentId && a.id !== targetId),
    accountFromRow(current),
  ];

  await prisma.systemLog.create({
    data: {
      action: "account_switched",
      entity: "utilisateur",
      entityId: targetId,
      userId: currentId,
      details: {
        from: { id: current.id, email: current.email, role: current.role, centerId: current.centerId },
        to: { id: target.id, email: target.email, role: target.role, centerId: target.centerId },
      },
    },
  });

  logger.info("Bascule de compte", { from: current.id, to: target.id });

  const nextToken: JWT = {
    ...(token as JWT),
    sub: target.id,
    id: target.id,
    role: target.role,
    nom: target.nom,
    prenom: target.prenom,
    centerId: target.centerId,
    email: target.email,
    name: `${target.prenom} ${target.nom}`,
    picture: target.image ?? null,
    linked,
  };

  const res = NextResponse.json({
    ok: true,
    role: target.role,
    linked,
  });
  writeSessionToken(res, nextToken);
  return res;
}