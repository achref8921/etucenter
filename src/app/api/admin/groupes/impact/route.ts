import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { computeGroupeDeleteImpact, hasSensitiveGroupeImpact } from "@/lib/groupe-impact";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis" }, { status: 400 });
    }

    const groupe = await prisma.groupe.findUnique({ where: { id } });
    if (!groupe || groupe.centerId !== centerId) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const impact = await computeGroupeDeleteImpact(centerId, id);

    return NextResponse.json({
      groupe: { id: groupe.id, nom: groupe.nom },
      impact,
      sensitive: hasSensitiveGroupeImpact(impact),
    });
  } catch (error) {
    logger.error("Erreur lors du calcul de l'impact de suppression du groupe", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}