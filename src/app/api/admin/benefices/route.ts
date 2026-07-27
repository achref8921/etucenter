import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");

    const now = new Date();
    const selectedMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const centreId = (session.user as any).centerId;

    const profs = await prisma.utilisateur.findMany({
      where: { role: "prof", centerId: centreId },
      include: {
        tauxBenefice: true,
        groupesEnseigne: {
          include: {
            paiements: {
              where: {
                datePaiement: { gte: startDate, lte: endDate },
              },
              select: { montant: true },
            },
            inscriptions: {
              where: { statut: "actif" },
              select: { eleveId: true },
            },
          },
        },
      },
    });

    const profsData = profs.map((e) => {
      const taux = e.tauxBenefice ? Number(e.tauxBenefice.tauxPourcentage) : 0;
      const totalRecu = e.groupesEnseigne.reduce(
        (sum, g) => sum + g.paiements.reduce((pSum, p) => pSum + Number(p.montant), 0),
        0
      );
      const beneficeCentre = totalRecu * taux / 100;
      const salaireProf = totalRecu - beneficeCentre;
      const eleveIds = new Set(
        e.groupesEnseigne.flatMap((g) => g.inscriptions.map((i) => i.eleveId))
      );

      return {
        prof: { id: e.id, nom: e.nom, prenom: e.prenom },
        tauxPourcentage: taux,
        totalRecu,
        beneficeCentre,
        salaireProf,
        nombreEleves: eleveIds.size,
      };
    });

    const totalRecu = profsData.reduce((s, e) => s + e.totalRecu, 0);
    const totalBenefice = profsData.reduce((s, e) => s + e.beneficeCentre, 0);
    const totalSalaire = profsData.reduce((s, e) => s + e.salaireProf, 0);

    const monthlyHistory: { month: string; totalBenefice: number; totalRecu: number; totalSalaire: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const mLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const paiements = await prisma.paiement.findMany({
        where: { datePaiement: { gte: mStart, lte: mEnd }, groupe: { centerId: centreId } },
        select: {
          montant: true,
          groupe: {
            select: {
              prof: {
                select: {
                  id: true,
                  tauxBenefice: { select: { tauxPourcentage: true } },
                },
              },
            },
          },
        },
      });

      let mRecu = 0;
      let mBenefice = 0;
      for (const p of paiements) {
        const montant = Number(p.montant);
        mRecu += montant;
        const taux = p.groupe.prof?.tauxBenefice
          ? Number(p.groupe.prof.tauxBenefice.tauxPourcentage)
          : 0;
        mBenefice += montant * taux / 100;
      }

      monthlyHistory.push({
        month: mLabel,
        totalBenefice: mBenefice,
        totalRecu: mRecu,
        totalSalaire: mRecu - mBenefice,
      });
    }

    return NextResponse.json({
      selectedMonth,
      profs: profsData,
      totalRecu,
      totalBenefice,
      totalSalaire,
      monthlyHistory,
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
