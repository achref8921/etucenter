import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("DELETE", ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;
    const adminCenterId = (session.user as any).centerId;

    const seance = await prisma.seance.findUnique({
      where: { id },
      select: { groupe: { select: { centerId: true } } },
    });

    if (!seance || seance.groupe.centerId !== adminCenterId) {
      return NextResponse.json({ error: "Séance non trouvée" }, { status: 404 });
    }

    const presencesCount = await prisma.presence.count({ where: { seanceId: id } });
    if (presencesCount > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer une séance qui contient des présences enregistrées" },
        { status: 400 }
      );
    }

    await prisma.seance.delete({ where: { id } });

    logger.info("Séance supprimée par l'admin", {
      adminId: (session.user as any).id,
      seanceId: id,
    });

    return NextResponse.json({ message: "Séance supprimée" });
  } catch (error) {
    logger.error("Erreur lors de la suppression de la séance", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
