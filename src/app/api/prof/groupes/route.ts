import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "prof") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const groupes = await prisma.groupe.findMany({
      where: { profId: (session.user as any).id },
      select: {
        id: true,
        nom: true,
        prixParSeance: true,
        _count: {
          select: {
            inscriptions: { where: { statut: "actif" } },
            seances: true,
          },
        },
      },
      orderBy: { nom: "asc" },
    });

    const result = groupes.map((g) => ({
      id: g.id,
      nom: g.nom,
      prixParSeance: Number(g.prixParSeance),
      nombreEleves: g._count.inscriptions,
      nombreSeances: g._count.seances,
    }));

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Erreur lors de la récupération des groupes", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
