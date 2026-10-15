import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DocumentCleanupError, purgeSeanceDocuments } from "@/lib/seance-documents-cleanup";

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

    // Les supports associés sont supprimés du stockage AVANT la séance : si un
    // fichier résiste, la séance est conservée (pas de fichier orphelin).
    try {
      await purgeSeanceDocuments(id);
    } catch (cleanupError) {
      if (cleanupError instanceof DocumentCleanupError) {
        return NextResponse.json(
          { error: "Suppression impossible : les fichiers de supports n'ont pas pu être supprimés du stockage." },
          { status: 502 }
        );
      }
      throw cleanupError;
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
