import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const userId = (session.user as any).id;
    const role = (session.user as any).role as string;

    if (role === "super_admin") {
      return NextResponse.json({ error: "Le compte super admin ne peut pas être supprimé" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { motDePasse } = body;

    if (!motDePasse) {
      return NextResponse.json({ error: "Le mot de passe est requis pour confirmer la suppression" }, { status: 400 });
    }

    const user = await prisma.utilisateur.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (!user.motDePasse) {
      return NextResponse.json({ error: "Compte sans mot de passe" }, { status: 400 });
    }

    const isValid = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!isValid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    await prisma.utilisateur.delete({ where: { id: userId } });

    logger.info("Compte supprimé définitivement par l'utilisateur", { userId, email: user.email });

    return NextResponse.json({ message: "Compte supprimé définitivement" });
  } catch (err) {
    logger.error("Erreur lors de la suppression du compte", { err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
