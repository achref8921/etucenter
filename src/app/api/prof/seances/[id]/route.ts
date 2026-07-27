import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

async function assertOwnSeance(userId: string, seanceId: string) {
  const seance = await prisma.seance.findUnique({
    where: { id: seanceId },
    select: {
      date: true,
      heureFin: true,
      groupe: { select: { profId: true } },
    },
  });
  if (!seance) return { error: "Séance non trouvée", status: 404, seance: null };
  if (seance.groupe.profId !== userId) return { error: "Non autorisé", status: 403, seance: null };
  return { error: null, status: 200, seance };
}

function isPastSession(seance: { date: Date; heureFin: Date | null }): boolean {
  const now = new Date();
  const dateStr = seance.date.toISOString().split("T")[0];
  let endDate: Date;
  if (seance.heureFin) {
    const timeStr = seance.heureFin.toISOString().split("T")[1];
    endDate = new Date(`${dateStr}T${timeStr}`);
  } else {
    endDate = new Date(`${dateStr}T23:59:59`);
  }
  return now > endDate;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const { id } = await params;
    const result = await assertOwnSeance((session.user as any).id, id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

    const body = await request.json();
    const { date, heureDebut, heureFin, notes, statut } = body;

    const pastSession = isPastSession(result.seance!);

    if (pastSession && (date !== undefined || heureDebut !== undefined || heureFin !== undefined)) {
      return NextResponse.json(
        { error: "Impossible de modifier la date ou les horaires d'une séance passée" },
        { status: 400 }
      );
    }

    const data: Record<string, any> = {};
    if (date !== undefined) data.date = new Date(date);
    if (heureDebut !== undefined) data.heureDebut = heureDebut ? new Date(heureDebut) : null;
    if (heureFin !== undefined) data.heureFin = heureFin ? new Date(heureFin) : null;
    if (notes !== undefined) data.notes = notes || null;
    if (statut !== undefined) data.statut = statut;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 });
    }

    const updated = await prisma.seance.update({
      where: { id },
      data,
      include: {
        groupe: { select: { id: true, nom: true } },
        _count: { select: { presences: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const { id } = await params;
    const result = await assertOwnSeance((session.user as any).id, id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

    if (isPastSession(result.seance!)) {
      return NextResponse.json(
        { error: "Impossible de supprimer une séance passée" },
        { status: 400 }
      );
    }

    const presencesCount = await prisma.presence.count({ where: { seanceId: id } });
    if (presencesCount > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer une séance qui contient des présences enregistrées" },
        { status: 400 }
      );
    }

    await prisma.seance.delete({ where: { id } });

    return NextResponse.json({ message: "Séance supprimée" });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
