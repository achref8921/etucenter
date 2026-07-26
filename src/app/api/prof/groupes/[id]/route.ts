import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "prof") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const groupe = await prisma.groupe.findFirst({
      where: { id, profId: (session.user as any).id },
      select: {
        id: true,
        nom: true,
        description: true,
        prixParSeance: true,
        capaciteMax: true,
        matiere: { select: { id: true, nom: true } },
        inscriptions: {
          where: { statut: "actif" },
          include: {
            eleve: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
        seances: {
          orderBy: { date: "desc" },
          select: {
            id: true,
            date: true,
            statut: true,
            _count: { select: { presences: true } },
          },
        },
      },
    });

    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    return NextResponse.json(groupe);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "prof") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { prixParSeance } = body;

    const groupe = await prisma.groupe.findFirst({
      where: { id, profId: (session.user as any).id },
    });

    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé ou non autorisé" }, { status: 404 });
    }

    if (prixParSeance === undefined || typeof prixParSeance !== "number" || prixParSeance < 0) {
      return NextResponse.json({ error: "Prix invalide" }, { status: 400 });
    }

    const updated = await prisma.groupe.update({
      where: { id },
      data: { prixParSeance },
      select: { id: true, nom: true, prixParSeance: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
