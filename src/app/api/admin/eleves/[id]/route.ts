import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateStudentStats } from "@/lib/calculations";

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
          select: {
            id: true,
            nom: true,
            profId: true,
            prixParSeance: true,
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

    const studentStats = await calculateStudentStats(id);
    const statsMap = new Map(studentStats.map((s) => [s.groupeId, s]));

    const inscriptionsWithStats = inscriptions.map((inscription) => {
      const stats = statsMap.get(inscription.groupeId);
      return {
        id: inscription.id,
        dateInscription: inscription.dateInscription,
        statut: inscription.statut,
        groupe: inscription.groupe,
        stats: stats
          ? {
              presencesCount: stats.presencesCount,
              absencesCount: stats.absencesCount,
              totalDue: stats.totalDue,
              totalPaid: stats.totalPaid,
              unpaid: stats.unpaid,
            }
          : { presencesCount: 0, absencesCount: 0, totalDue: 0, totalPaid: 0, unpaid: 0 },
      };
    });

    const [paiements, presences] = await Promise.all([
      prisma.paiement.findMany({
        where: { eleveId: id },
        include: {
          groupe: {
            select: { id: true, nom: true },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),
      prisma.presence.findMany({
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
      }),
    ]);

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
