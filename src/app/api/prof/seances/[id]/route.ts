import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { clientNowFromOffset } from "@/lib/utils";

async function assertOwnSeance(userId: string, seanceId: string) {
  const seance = await prisma.seance.findUnique({
    where: { id: seanceId },
    select: {
      date: true,
      heureDebut: true,
      heureFin: true,
      groupe: { select: { id: true, nom: true, profId: true, centerId: true } },
    },
  });
  if (!seance) return { error: "Séance non trouvée", status: 404, seance: null };
  if (seance.groupe.profId !== userId) return { error: "Non autorisé", status: 403, seance: null };
  return { error: null, status: 200, seance };
}

function formatDateFr(date: Date): string {
  return new Date(date).toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeFr(time: Date | null): string | null {
  if (!time) return null;
  return new Date(time).toLocaleTimeString("fr-TN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function notifyGroupeStudents(
  centerId: string,
  groupeId: string,
  groupeNom: string,
  titre: string,
  message: string,
  url: string
) {
  const inscriptions = await prisma.inscription.findMany({
    where: { groupeId, statut: "actif" },
    select: { eleveId: true },
  });
  const eleveIds = inscriptions.map((i) => i.eleveId);
  if (eleveIds.length === 0) return;

  await prisma.notification.createMany({
    data: eleveIds.map((destinataireId) => ({
      centerId,
      destinataireId,
      titre,
      message,
      type: "nouvelle_seance",
    })),
  });
  await sendPushToUsers(eleveIds, { title: titre, body: message, url }).catch(() => {});
}

function isPastSession(
  seance: { date: Date; heureFin: Date | null },
  now: Date = new Date()
): boolean {
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
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
    if (error) return error;

    const { id } = await params;
    const result = await assertOwnSeance((session.user as any).id, id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

    const body = await request.json();
    const { date, heureDebut, heureFin, notes, statut, timezoneOffset } = body;

    const pastSession = isPastSession(result.seance!, clientNowFromOffset(timezoneOffset));

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

    const timeChanged =
      date !== undefined || heureDebut !== undefined || heureFin !== undefined;
    if (timeChanged) {
      const dateStr = formatDateFr(updated.date);
      const timeStr = formatTimeFr(updated.heureDebut);
      const when = timeStr ? `le ${dateStr} à ${timeStr}` : `le ${dateStr}`;
      await notifyGroupeStudents(
        result.seance!.groupe.centerId,
        updated.groupe.id,
        updated.groupe.nom,
        "Séance modifiée",
        `La séance du groupe "${updated.groupe.nom}" a été déplacée ${when}.`,
        "/eleve/notifications"
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter(request.method, PROF_ROLES);
    if (error) return error;

    const { id } = await params;

    const result = await assertOwnSeance((session.user as any).id, id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

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
