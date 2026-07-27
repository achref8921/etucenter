import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const centreId = (session.user as any).centerId;

    const profs = await prisma.utilisateur.findMany({
      where: { role: "prof", centerId: centreId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        tauxBenefice: {
          select: {
            id: true,
            tauxPourcentage: true,
          },
        },
        groupesEnseigne: {
          select: {
            id: true,
            nom: true,
            _count: {
              select: {
                inscriptions: { where: { statut: "actif" } },
              },
            },
          },
        },
      },
      orderBy: { nom: "asc" },
    });

    const result = profs.map((e) => ({
      id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      email: e.email,
      tauxPourcentage: e.tauxBenefice ? Number(e.tauxBenefice.tauxPourcentage) : null,
      tauxBeneficeId: e.tauxBenefice?.id || null,
      nombreGroupes: e.groupesEnseigne.length,
      nombreEleves: e.groupesEnseigne.reduce((sum, g) => sum + g._count.inscriptions, 0),
      groupes: e.groupesEnseigne.map((g) => ({
        id: g.id,
        nom: g.nom,
        nombreEleves: g._count.inscriptions,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const body = await request.json();
    const { profId, tauxPourcentage } = body;

    if (!profId || tauxPourcentage === undefined) {
      return NextResponse.json({ error: "profId et tauxPourcentage sont requis" }, { status: 400 });
    }

    if (typeof tauxPourcentage !== "number" || tauxPourcentage < 0 || tauxPourcentage > 100) {
      return NextResponse.json({ error: "Le taux doit être entre 0 et 100" }, { status: 400 });
    }

    const prof = await prisma.utilisateur.findUnique({
      where: { id: profId, centerId: (session.user as any).centerId },
    });

    if (!prof || prof.role !== "prof") {
      return NextResponse.json({ error: "Prof non trouvé" }, { status: 404 });
    }

    const taux = await prisma.tauxBenefice.upsert({
      where: { profId },
      update: { tauxPourcentage },
      create: { profId, tauxPourcentage },
    });

    return NextResponse.json({
      id: taux.id,
      profId: taux.profId,
      tauxPourcentage: Number(taux.tauxPourcentage),
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
