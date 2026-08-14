import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateTotalDue, calculateTotalPaid, calculateUnpaid } from "@/lib/calculations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;

    const centreId = (session.user as any).centerId;

    const eleve = await prisma.utilisateur.findUnique({
      where: { id, role: "eleve", centerId: centreId, deletedAt: null },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        image: true,
        codeEleve: true,
        niveau: true,
        classe: true,
        filiere: true,
        dateNaissance: true,
        actif: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const inscriptions = await prisma.inscription.findMany({
      where: { eleveId: id },
      include: {
        groupe: {
          include: {
            prof: {
              select: { id: true, nom: true, prenom: true },
            },
            matiere: {
              select: { id: true, nom: true },
            },
          },
        },
      },
      orderBy: { dateInscription: "desc" },
    });

    const inscriptionsWithStats = await Promise.all(
      inscriptions.map(async (inscription: any) => {
        const [presencesCount, absencesCount, totalDue, totalPaid, unpaid] = await Promise.all([
          prisma.presence.count({
            where: {
              eleveId: id,
              statut: "present",
              seance: { groupeId: inscription.groupeId },
            },
          }),
          prisma.presence.count({
            where: {
              eleveId: id,
              statut: "absent",
              seance: { groupeId: inscription.groupeId },
            },
          }),
          calculateTotalDue(id, inscription.groupeId),
          calculateTotalPaid(id, inscription.groupeId),
          calculateUnpaid(id, inscription.groupeId),
        ]);

        return {
          id: inscription.id,
          dateInscription: inscription.dateInscription,
          statut: inscription.statut,
          groupe: inscription.groupe,
          stats: {
            presencesCount,
            absencesCount,
            totalDue,
            totalPaid,
            unpaid,
          },
        };
      })
    );

    const paiements = await prisma.paiement.findMany({
      where: { eleveId: id },
      include: {
        groupe: {
          select: { id: true, nom: true },
        },
      },
      orderBy: { datePaiement: "desc" },
    });

    const presences = await prisma.presence.findMany({
      where: { eleveId: id },
      select: {
        id: true,
        statut: true,
        seance: {
          select: {
            id: true,
            date: true,
            statut: true,
            groupe: {
              select: {
                id: true,
                nom: true,
                matiere: { select: { nom: true } },
                prof: { select: { id: true, nom: true, prenom: true } },
              },
            },
          },
        },
      },
      orderBy: { seance: { date: "desc" } },
    });

    logger.info("Détails élève récupérés", {
      adminId: (session.user as any).id,
      eleveId: id,
    });

    return NextResponse.json({ eleve, inscriptions: inscriptionsWithStats, paiements, presences });
  } catch (error) {
    logger.error("Erreur lors de la récupération des détails élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
