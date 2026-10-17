import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET — Registre des paiements annulés du centre.
 *
 * Renvoie les empreintes des paiements annulés (élève, groupe, montant, motif,
 * auteur, date). Les paiements eux-mêmes ont été définitivement retirés de la
 * comptabilité : ce registre sert de piste d'audit lisible par l'administration.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const annules = await prisma.paiementAnnule.findMany({
      where: { centerId },
      orderBy: { annuleLe: "desc" },
      take: 300,
    });

    return NextResponse.json(annules);
  } catch (error) {
    logger.error("Erreur lors de la récupération des paiements annulés", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
