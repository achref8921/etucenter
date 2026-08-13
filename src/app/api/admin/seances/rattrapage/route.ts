import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES, PROF_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rattrapageSchema } from "@/lib/validations";
import { consumeCourseAttendance } from "@/lib/student-finance";
import { sendPushToUsers } from "@/lib/push";

function formatDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("POST", [...ADMIN_ROLES, ...PROF_ROLES]);
    if (error) return error;

    const adminId = (session.user as any).id;
    const sessionRole = (session.user as any).role as string;
    const isProf = sessionRole === "prof";
    const centerId = (session.user as any).centerId;

    const body = await request.json();
    const parsed = rattrapageSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn("Validation échouée pour la séance de rattrapage", { errors: parsed.error.flatten() });
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { eleveId, groupeId, date, heureDebut, heureFin, notes } = parsed.data;

    const eleve = await prisma.utilisateur.findFirst({
      where: isProf
        ? { id: eleveId, role: "eleve", deletedAt: null }
        : { id: eleveId, centerId, role: "eleve", deletedAt: null },
      select: { id: true, prenom: true, nom: true },
    });
    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const groupe = isProf
      ? await prisma.groupe.findFirst({
          where: { id: groupeId, profId: adminId },
          select: { id: true, nom: true, prixParSeance: true },
        })
      : await prisma.groupe.findFirst({
          where: { id: groupeId, centerId },
          select: { id: true, nom: true, prixParSeance: true },
        });
    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé" }, { status: 404 });
    }

    const inscription = await prisma.inscription.findFirst({
      where: { eleveId, groupeId, statut: "actif" },
    });
    if (!inscription) {
      return NextResponse.json(
        { error: "L'élève n'est pas inscrit dans ce groupe" },
        { status: 400 }
      );
    }

    const price = Number(groupe.prixParSeance);
    if (!price || price <= 0) {
      return NextResponse.json(
        { error: "Le prix par séance de ce groupe est invalide" },
        { status: 400 }
      );
    }

    const seanceDate = new Date(`${date}T00:00:00.000Z`);
    const buildTime = (t?: string) => (t ? new Date(`${date}T${t}:00.000Z`) : null);

    const { seance, presence, consumption } = await prisma.$transaction(async (tx) => {
      const s = await tx.seance.create({
        data: {
          groupeId,
          date: seanceDate,
          heureDebut: buildTime(heureDebut),
          heureFin: buildTime(heureFin),
          statut: "terminee",
          notes: notes?.trim() || `Séance de rattrapage — ${eleve.prenom} ${eleve.nom}`,
        },
      });
      const p = await tx.presence.create({
        data: { seanceId: s.id, eleveId, statut: "present", enregistrePar: adminId },
      });
      const c = await consumeCourseAttendance(
        { centerId, eleveId, attendanceId: p.id, actorId: adminId },
        tx
      );
      return { seance: s, presence: p, consumption: c };
    });

    const when = heureDebut ? `le ${formatDateFr(date)} à ${heureDebut}` : `le ${formatDateFr(date)}`;
    const titre = "Séance de rattrapage ajoutée";
    const message = `Une séance a été ajoutée pour vous ${when} dans le groupe "${groupe.nom}". Le montant de ${price.toFixed(2)} DT a été déduit de votre compte.`;

    await prisma.notification.create({
      data: {
        centerId,
        destinataireId: eleveId,
        titre,
        message,
        type: "nouvelle_seance",
      },
    });
    await sendPushToUsers([eleveId], {
      title: titre,
      body: message,
      url: "/eleve/notifications",
    }).catch(() => {});

    logger.info("Séance de rattrapage ajoutée", {
      adminId,
      eleveId,
      seanceId: seance.id,
      groupeId,
      price,
    });

    return NextResponse.json({ seance, presence, consumption }, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de l'ajout d'une séance de rattrapage", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
