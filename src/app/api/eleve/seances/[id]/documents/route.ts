import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ELEVE_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { authorizeSeanceAccess, loadDocUser, MAX_FILES_PER_SEANCE } from "@/lib/seance-documents";

/**
 * GET /api/eleve/seances/[id]/documents
 * Liste en lecture seule des supports d'une séance. L'élève doit avoir une
 * inscription ACTIVE dans le groupe de la séance, et être du même centre.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, frozen, error } = await requireActiveCenter("GET", ELEVE_ROLES);
    if (error) return error;

    const user = await loadDocUser((session.user as any).id, !!frozen);
    if (!user) {
      return NextResponse.json({ error: "Compte introuvable ou inactif" }, { status: 401 });
    }

    const { id } = await params;
    const scope = await authorizeSeanceAccess(user, id);
    if (!scope.ok) return scope.response;

    // Filtrage côté requête : un dépôt encore en cours de validation n'est pas
    // un support. Le compte est aussi borné au nombre de documents autorisés
    // pour ne jamais exposer l'existence d'un fichier en attente.
    const documents = await prisma.seanceDocument.findMany({
      where: { seanceId: scope.seance.id, statut: "pret" },
      orderBy: { createdAt: "asc" },
      take: MAX_FILES_PER_SEANCE,
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        description: true,
        statut: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      seance: { id: scope.seance.id, date: scope.seance.date, statut: scope.seance.statut },
      groupe: { id: scope.groupe.id, nom: scope.groupe.nom },
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        description: d.description,
        statut: d.statut,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    logger.error("Erreur lors de la récupération des supports (élève)", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
