import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateTotalDue, calculateTotalPaid, calculateUnpaid } from "@/lib/calculations";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "eleve") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const inscriptions = await prisma.inscription.findMany({
      where: {
        eleveId: (session.user as any).id,
        statut: "actif",
      },
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

    const groupesWithStats = await Promise.all(
      inscriptions.map(async (inscription: any) => {
        const [totalDue, totalPaid, unpaid] = await Promise.all([
          calculateTotalDue((session.user as any).id, inscription.groupeId),
          calculateTotalPaid((session.user as any).id, inscription.groupeId),
          calculateUnpaid((session.user as any).id, inscription.groupeId),
        ]);

        return {
          inscription: {
            id: inscription.id,
            dateInscription: inscription.dateInscription,
            statut: inscription.statut,
          },
          groupe: inscription.groupe,
          stats: {
            totalDue,
            totalPaid,
            unpaid,
          },
        };
      })
    );

    logger.info("Groupes élève récupérés", { eleveId: (session.user as any).id, count: groupesWithStats.length });

    return NextResponse.json(groupesWithStats);
  } catch (error) {
    logger.error("Erreur lors de la récupération des groupes élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
