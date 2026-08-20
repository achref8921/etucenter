import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    if ((session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Seul un super admin peut supprimer définitivement un compte" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { motDePasse } = body;

    if (!motDePasse) {
      return NextResponse.json({ error: "Le mot de passe est requis pour confirmer la suppression" }, { status: 400 });
    }

    const currentUserId = (session.user as any).id;

    if (id === currentUserId) {
      return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 403 });
    }

    const targetUser = await prisma.utilisateur.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const currentUser = await prisma.utilisateur.findUnique({ where: { id: currentUserId } });
    if (!currentUser || !currentUser.motDePasse) {
      return NextResponse.json({ error: "Compte sans mot de passe" }, { status: 400 });
    }

    const isValid = await bcrypt.compare(motDePasse, currentUser.motDePasse);
    if (!isValid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    await prisma.utilisateur.delete({ where: { id } });

    logger.info("Utilisateur supprimé définitivement", {
      adminId: currentUserId,
      deletedUserId: id,
      deletedEmail: targetUser.email,
    });

    return NextResponse.json({ message: "Compte supprimé définitivement" });
  } catch (err) {
    logger.error("Erreur lors de la suppression définitive", { err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
