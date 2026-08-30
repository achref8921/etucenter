import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ["super_admin"]);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis" }, { status: 400 });
    }

    const currentUserId = (session.user as any).id;
    if (id === currentUserId) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer définitivement votre propre compte" },
        { status: 403 }
      );
    }

    const user = await prisma.utilisateur.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    if (user.role === "super_admin") {
      return NextResponse.json(
        { error: "Impossible de supprimer définitivement un compte super admin" },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const groupes =
        user.role === "prof"
          ? await tx.groupe.count({ where: { profId: id } })
          : 0;
      await tx.groupe.updateMany({ where: { profId: id }, data: { profId: null } });
      await tx.presence.updateMany({ where: { enregistrePar: id }, data: { enregistrePar: null } });

      const inscriptions =
        user.role === "eleve"
          ? await tx.inscription.count({ where: { eleveId: id } })
          : 0;
      const paiements =
        user.role === "eleve"
          ? await tx.paiement.count({ where: { eleveId: id } })
          : 0;

      await tx.utilisateur.delete({ where: { id } });

      return { inscriptions, paiements, groupes };
    });

    logger.warn("Utilisateur supprimé définitivement par un super admin", {
      superAdminId: currentUserId,
      deletedUserId: id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      message: `Compte de ${user.prenom} ${user.nom} supprimé définitivement. Toutes ses données associées (inscriptions, paiements, présences, notifications…) ont été purgées.`,
    });
  } catch (error) {
    logger.error("Erreur lors de la suppression définitive", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}