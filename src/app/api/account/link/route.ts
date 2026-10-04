import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  LINKED_ACCOUNTS_MAX,
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

  let body: { email?: unknown; motDePasse?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const motDePasse = typeof body.motDePasse === "string" ? body.motDePasse : "";

  if (!email || !motDePasse) {
    return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
  }

  const target = await prisma.utilisateur.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      nom: true,
      prenom: true,
      email: true,
      centerId: true,
      motDePasse: true,
      actif: true,
      ghost: true,
      deletedAt: true,
    },
  });

  if (!target || !target.motDePasse || target.ghost || target.deletedAt || !target.actif) {
    return NextResponse.json({ error: "Compte introuvable ou désactivé" }, { status: 404 });
  }

  if (target.id === currentId) {
    return NextResponse.json({ error: "C'est déjà le compte actif" }, { status: 400 });
  }

  const passwordOk = await bcrypt.compare(motDePasse, target.motDePasse);
  if (!passwordOk) {
    logger.warn("Liaison de compte refusée : mot de passe incorrect", { currentId, email });
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const center = await prisma.center.findUnique({
    where: { id: target.centerId },
    select: { active: true },
  });
  if (!center?.active) {
    return NextResponse.json({ error: "Le centre de ce compte est suspendu" }, { status: 403 });
  }

  const existing = await sanitizeLinked(readLinked(token), currentId);
  if (existing.some((a) => a.id === target.id)) {
    const res = NextResponse.json({ linked: existing });
    writeSessionToken(res, { ...(token as JWT), linked: existing });
    return res;
  }

  if (existing.length >= LINKED_ACCOUNTS_MAX) {
    return NextResponse.json(
      { error: `Maximum ${LINKED_ACCOUNTS_MAX} comptes liés. Déposez-en un d'abord.` },
      { status: 400 }
    );
  }

  const linked = [...existing, accountFromRow(target)];

  await prisma.systemLog.create({
    data: {
      action: "account_linked",
      entity: "utilisateur",
      entityId: target.id,
      userId: currentId,
      details: {
        from: { id: currentId, email: token.email ?? null, role: token.role ?? null },
        to: { id: target.id, email: target.email, role: target.role },
      },
    },
  });

  logger.info("Compte lié pour bascule rapide", { from: currentId, to: target.id });

  const res = NextResponse.json({ linked });
  writeSessionToken(res, { ...(token as JWT), linked });
  return res;
}