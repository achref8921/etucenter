import { NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const groupes = await prisma.groupe.findMany({
      where: { profId: (session.user as any).id },
      select: {
        id: true,
        nom: true,
        prixParSeance: true,
        forfaitMontant: true,
        forfaitSeances: true,
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
      forfaitMontant: g.forfaitMontant !== null ? Number(g.forfaitMontant) : null,
      forfaitSeances: g.forfaitSeances,
      nombreEleves: g._count.inscriptions,
      nombreSeances: g._count.seances,
    }));

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Erreur lors de la récupération des groupes", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
