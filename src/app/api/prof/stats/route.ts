import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "prof") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const [tauxBenefice, groupes, presencesTerminees, paiements] = await Promise.all([
      prisma.tauxBenefice.findUnique({ where: { profId: userId } }),
      prisma.groupe.findMany({
        where: { profId: userId },
        select: {
          id: true,
          nom: true,
          prixParSeance: true,
          _count: { select: { inscriptions: { where: { statut: "actif" } }, seances: true } },
        },
      }),
      prisma.presence.count({
        where: {
          statut: "present",
          seance: {
            groupe: { profId: userId },
            statut: "terminee",
          },
        },
      }),
      prisma.paiement.findMany({
        where: {
          groupe: { profId: userId },
        },
        select: { montant: true },
      }),
    ]);

    const taux = tauxBenefice ? Number(tauxBenefice.tauxPourcentage) : 0;

    let totalRevenuBrut = 0;
    for (const g of groupes) {
      totalRevenuBrut += g._count.inscriptions * Number(g.prixParSeance);
    }

    const totalRevenuNet = totalRevenuBrut * (taux / 100);
    const totalEleves = groupes.reduce((sum, g) => sum + g._count.inscriptions, 0);
    const totalSeances = groupes.reduce((sum, g) => sum + g._count.seances, 0);
    const totalPaiements = paiements.reduce((sum, p) => sum + Number(p.montant), 0);

    return NextResponse.json({
      tauxPourcentage: taux,
      totalRevenuBrut,
      totalRevenuNet,
      totalEleves,
      totalSeances,
      totalSeancesTerminees: presencesTerminees,
      totalPaiementsRecus: totalPaiements,
      groupes: groupes.map((g) => ({
        id: g.id,
        nom: g.nom,
        prixParSeance: Number(g.prixParSeance),
        nbEleves: g._count.inscriptions,
        nbSeances: g._count.seances,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
