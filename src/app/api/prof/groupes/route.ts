import { NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

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
