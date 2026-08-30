import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

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

    const counts = await prisma.$transaction(async (tx) => {
      const groupes =
        user.role === "prof" ? await tx.groupe.count({ where: { profId: id } }) : 0;
      await tx.groupe.updateMany({ where: { profId: id }, data: { profId: null } });
      await tx.presence.updateMany({ where: { enregistrePar: id }, data: { enregistrePar: null } });

      const inscriptions =
        user.role === "eleve" ? await tx.inscription.count({ where: { eleveId: id } }) : 0;
      const paiements =
        user.role === "eleve" ? await tx.paiement.count({ where: { eleveId: id } }) : 0;

      await tx.utilisateur.delete({ where: { id } });

      return { inscriptions, paiements, groupes };
    });

    logger.warn("Utilisateur supprimé définitivement par un super admin", {
      superAdminId: currentUserId,
      deletedUserId: id,
      email: user.email,
      role: user.role,
    });

    await prisma.systemLog.create({
      data: {
        action: "user_permanently_deleted_by_superadmin",
        entity: "utilisateur",
        entityId: id,
        details: {
          centerId: user.centerId,
          email: user.email,
          role: user.role,
          inscriptions: counts.inscriptions,
          paiements: counts.paiements,
          groupes: counts.groupes,
        },
        userId: currentUserId,
      },
    });

    return NextResponse.json({
      message: `Compte de ${user.prenom} ${user.nom} supprimé définitivement. Toutes ses données associées (inscriptions, paiements, présences, notifications…) ont été purgées.`,
    });
  } catch (error) {
    logger.error("Erreur lors de la suppression définitive", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}