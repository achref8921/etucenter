import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateTotalDue, calculateTotalPaid, calculateUnpaid } from "@/lib/calculations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdminRole((session.user as any).role as string)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const centreId = (session.user as any).centerId;

    const groupe = await prisma.groupe.findUnique({
      where: { id },
      include: {
        prof: {
          select: { id: true, nom: true, prenom: true },
        },
        matiere: {
          select: { id: true, nom: true },
        },
      },
    });

    if (!groupe || groupe.centerId !== centreId) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const inscriptions = await prisma.inscription.findMany({
      where: { groupeId: id },
      include: {
        eleve: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
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
              eleveId: inscription.eleveId,
              statut: "present",
              seance: { groupeId: id },
            },
          }),
          prisma.presence.count({
            where: {
              eleveId: inscription.eleveId,
              statut: "absent",
              seance: { groupeId: id },
            },
          }),
          calculateTotalDue(inscription.eleveId, id),
          calculateTotalPaid(inscription.eleveId, id),
          calculateUnpaid(inscription.eleveId, id),
        ]);

        return {
          id: inscription.id,
          dateInscription: inscription.dateInscription,
          statut: inscription.statut,
          eleve: inscription.eleve,
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

    const seances = await prisma.seance.findMany({
      where: { groupeId: id },
      include: {
        _count: {
          select: {
            presences: { where: { statut: "present" } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const seancesWithStats = await Promise.all(
      seances.map(async (seance: any) => {
        const totalPresences = await prisma.presence.count({
          where: { seanceId: seance.id },
        });

        return {
          id: seance.id,
          date: seance.date,
          heureDebut: seance.heureDebut,
          heureFin: seance.heureFin,
          statut: seance.statut,
          notes: seance.notes,
          stats: {
            presentsCount: seance._count.presences,
            totalEleves: totalPresences,
          },
        };
      })
    );

    const financialSummary = inscriptionsWithStats.reduce(
      (acc, insc) => ({
        totalDue: acc.totalDue + insc.stats.totalDue,
        totalPaid: acc.totalPaid + insc.stats.totalPaid,
        unpaid: acc.unpaid + insc.stats.unpaid,
      }),
      { totalDue: 0, totalPaid: 0, unpaid: 0 }
    );

    logger.info("Détails groupe récupérés", {
      adminId: (session.user as any).id,
      groupeId: id,
    });

    return NextResponse.json({
      groupe,
      inscriptions: inscriptionsWithStats,
      seances: seancesWithStats,
      financialSummary,
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération des détails groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
