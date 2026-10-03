import { NextRequest, NextResponse } from "next/server";
import { trackEventSafe } from "@/lib/analytics";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateStudentStats } from "@/lib/calculations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const { id } = await params;

    const centreId = (session.user as any).centerId;
    const profId = (session.user as any).id;

    // Périmètre du professeur : uniquement les groupes dont il est titulaire.
    const monGroupes = await prisma.groupe.findMany({
      where: { centerId: centreId, profId: profId },
      select: { id: true },
    });
    const groupeIds = monGroupes.map((g) => g.id);

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

    // Un professeur ne voit que les élèves inscrits dans AU MOINS UN de ses groupes.
    // Sinon on renvoie 404 : on ne révèle pas l'existence d'un élève hors périmètre.
    if (groupeIds.length === 0) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const inscriptions = await prisma.inscription.findMany({
      where: { eleveId: id, groupeId: { in: groupeIds } },
      include: {
        groupe: {
          select: {
            id: true,
            nom: true,
            prixParSeance: true,
            matiere: {
              select: { id: true, nom: true },
            },
          },
        },
      },
      orderBy: { dateInscription: "desc" },
    });

    if (inscriptions.length === 0) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    // Les statistiques sont calculées et filtrées en base sur les groupes du
    // professeur : aucune donnée d'un autre groupe n'est chargée en mémoire.
    const studentStats = await calculateStudentStats(id, groupeIds);
    const statsMap = new Map(studentStats.map((s) => [s.groupeId, s]));

    const inscriptionsWithStats = inscriptions.map((inscription) => {
      const stats = statsMap.get(inscription.groupeId);
      return {
        id: inscription.id,
        dateInscription: inscription.dateInscription,
        statut: inscription.statut,
        forfaitMontant: inscription.forfaitMontant,
        forfaitSeances: inscription.forfaitSeances,
        forfaitSetAt: inscription.forfaitSetAt,
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
        where: { eleveId: id, groupeId: { in: groupeIds } },
        include: {
          groupe: {
            select: { id: true, nom: true },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),
      prisma.presence.findMany({
        where: { eleveId: id, seance: { groupeId: { in: groupeIds } } },
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
                },
              },
            },
          },
        },
        orderBy: { seance: { date: "desc" } },
      }),
    ]);

    logger.info("Détails élève récupérés (prof, périmètre restreint)", {
      profId,
      eleveId: id,
      nbGroupes: groupeIds.length,
    });

    void trackEventSafe({
      userId: profId,
      centerId: centreId,
      event: "STUDENT_VIEWED",
      feature: "Élèves",
      metadata: { studentId: id, scope: "prof" },
    });

    const { image, ...eleveWithoutImage } = eleve;

    return NextResponse.json({
      eleve: { ...eleveWithoutImage, hasImage: image !== null },
      inscriptions: inscriptionsWithStats,
      paiements,
      presences,
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération des détails élève (prof)", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}