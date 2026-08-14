import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const { id } = await params;

    const groupe = await prisma.groupe.findFirst({
      where: { id, profId: (session.user as any).id },
      select: {
        id: true,
        nom: true,
        description: true,
        prixParSeance: true,
        forfaitMontant: true,
        forfaitSeances: true,
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
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { nom, description, capaciteMax, prixParSeance, forfaitMontant, forfaitSeances } = body;

    const groupe = await prisma.groupe.findFirst({
      where: { id, profId: (session.user as any).id },
    });

    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé ou non autorisé" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (nom !== undefined) {
      if (typeof nom !== "string" || !nom.trim()) {
        return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
      }
      data.nom = nom.trim();
    }
    if (description !== undefined) {
      if (typeof description !== "string") {
        return NextResponse.json({ error: "Description invalide" }, { status: 400 });
      }
      data.description = description.trim() || null;
    }
    if (capaciteMax !== undefined) {
      if (typeof capaciteMax !== "number" || capaciteMax < 0) {
        return NextResponse.json({ error: "Capacité invalide" }, { status: 400 });
      }
      data.capaciteMax = capaciteMax;
    }
    const hasForfait = forfaitMontant !== undefined || forfaitSeances !== undefined;
    if (hasForfait) {
      if (
        typeof forfaitMontant !== "number" ||
        typeof forfaitSeances !== "number" ||
        forfaitMontant <= 0 ||
        forfaitSeances <= 0 ||
        !Number.isInteger(forfaitSeances)
      ) {
        return NextResponse.json(
          { error: "Montant et nombre de séances du forfait requis (nombres positifs, séances entières)" },
          { status: 400 }
        );
      }
      data.forfaitMontant = forfaitMontant;
      data.forfaitSeances = forfaitSeances;
      data.prixParSeance = Math.round((forfaitMontant / forfaitSeances) * 100) / 100;
    } else if (prixParSeance !== undefined) {
      if (typeof prixParSeance !== "number" || prixParSeance < 0) {
        return NextResponse.json({ error: "Prix invalide" }, { status: 400 });
      }
      data.prixParSeance = prixParSeance;
      data.forfaitMontant = null;
      data.forfaitSeances = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }

    const updated = await prisma.groupe.update({
      where: { id },
      data,
      select: {
        id: true,
        nom: true,
        description: true,
        prixParSeance: true,
        forfaitMontant: true,
        forfaitSeances: true,
        capaciteMax: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
