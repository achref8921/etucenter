import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ghostifyAccount } from "@/lib/ghost";

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const userId = (session.user as any).id;
    const role = (session.user as any).role as string;

    if (role === "super_admin" || role === "admin") {
      return NextResponse.json({ error: "Les comptes administrateur ne peuvent pas être supprimés de cette façon" }, { status: 403 });
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

    if (user.ghost) {
      return NextResponse.json({ error: "Ce compte a déjà été supprimé" }, { status: 400 });
    }

    const isValid = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!isValid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    const ghost = await ghostifyAccount(userId);

    logger.info("Compte transformé en fantôme par l'utilisateur", { userId, email: user.email, role });

    const soldeText = (ghost.soldeNet ?? 0) !== 0
      ? ` Un solde de ${Math.abs(Math.round(ghost.soldeNet ?? 0))} TND reste associé au compte et reste visible pour l'administration.`
      : "";

    return NextResponse.json({
      message: "Votre compte a été supprimé. Un administrateur du centre peut encore le consulter pour régulariser d'éventuelles dettes." + soldeText,
      ghost: true,
    });
  } catch (err) {
    logger.error("Erreur lors de la suppression du compte", { err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}