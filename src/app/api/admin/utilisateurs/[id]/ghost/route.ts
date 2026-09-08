import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildGhostDeleteImpact, deleteGhostAccount } from "@/lib/ghost";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const { id } = await ctx.params;
    const centerId = (session.user as any).centerId;

    const target = await prisma.utilisateur.findUnique({ where: { id } });
    if (!target || target.centerId !== centerId) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (!target.ghost) {
      return NextResponse.json({ error: "Ce compte n'est pas un compte supprimé (fantôme)" }, { status: 400 });
    }

    const impact = await buildGhostDeleteImpact(centerId, id);

    return NextResponse.json({ nom: target.nom, prenom: target.prenom, role: target.role, impact });
  } catch (err) {
    logger.error("Erreur lors du calcul d'impact du fantôme", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const { id } = await ctx.params;
    const adminId = (session.user as any).id;
    const adminRole = (session.user as any).role as string;
    const centerId = (session.user as any).centerId;

    if (id === adminId) {
      return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 403 });
    }

    const target = await prisma.utilisateur.findUnique({ where: { id } });
    if (!target || target.centerId !== centerId) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (!target.ghost) {
      return NextResponse.json({ error: "Ce compte n'est pas un compte supprimé (fantôme)" }, { status: 400 });
    }

    if (target.role === "admin" && adminRole !== "super_admin") {
      return NextResponse.json({ error: "Seul un super admin peut supprimer un admin" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { motDePasse } = body;

    if (!motDePasse) {
      return NextResponse.json({ error: "Le mot de passe administrateur est requis pour confirmer" }, { status: 400 });
    }

    const admin = await prisma.utilisateur.findUnique({ where: { id: adminId } });
    if (!admin?.motDePasse) {
      return NextResponse.json({ error: "Compte sans mot de passe" }, { status: 400 });
    }

    const isValid = await bcrypt.compare(motDePasse, admin.motDePasse);
    if (!isValid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    const impact = await buildGhostDeleteImpact(centerId, id);
    await deleteGhostAccount(centerId, id, adminId);

    logger.info("Compte fantôme supprimé définitivement par l'admin", { adminId, ghostId: id, email: target.email });

    return NextResponse.json({
      message: `Compte de ${target.prenom} ${target.nom} et toutes ses données supprimés définitivement.`,
      impact,
    });
  } catch (err) {
    logger.error("Erreur lors de la suppression définitive du fantôme", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}