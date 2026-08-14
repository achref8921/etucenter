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

    const { eleveId, eleveIds, groupeId, date, heureDebut, heureFin, notes } = parsed.data;
    const eleveIdList = eleveIds && eleveIds.length > 0 ? [...new Set(eleveIds)] : eleveId ? [eleveId] : [];

    if (eleveIdList.length === 0) {
      return NextResponse.json({ error: "Sélectionnez au moins un élève" }, { status: 400 });
    }

    const eleves = await prisma.utilisateur.findMany({
      where: isProf
        ? { id: { in: eleveIdList }, role: "eleve", deletedAt: null }
        : { id: { in: eleveIdList }, centerId, role: "eleve", deletedAt: null },
      select: { id: true, prenom: true, nom: true },
    });
    if (eleves.length !== eleveIdList.length) {
      return NextResponse.json({ error: "Un ou plusieurs élèves introuvables" }, { status: 404 });
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

    const inscriptions = await prisma.inscription.findMany({
      where: { eleveId: { in: eleveIdList }, groupeId, statut: "actif" },
      select: { eleveId: true },
    });
    if (inscriptions.length !== eleveIdList.length) {
      return NextResponse.json(
        { error: "Un ou plusieurs élèves ne sont pas inscrits dans ce groupe" },
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

    const existingPresence = await prisma.presence.findFirst({
      where: {
        eleveId: { in: eleveIdList },
        seance: { groupeId, date: seanceDate },
      },
      include: { seance: { select: { id: true, date: true } } },
    });
    if (existingPresence) {
      return NextResponse.json(
        { error: "Un de ces élèves a déjà une séance enregistrée à cette date pour ce groupe" },
        { status: 409 }
      );
    }

    const names = eleves.map((el) => `${el.prenom} ${el.nom}`).join(", ");

    const { seance, presences, consumptions } = await prisma.$transaction(async (tx) => {
      const s = await tx.seance.create({
        data: {
          groupeId,
          date: seanceDate,
          heureDebut: buildTime(heureDebut),
          heureFin: buildTime(heureFin),
          statut: "terminee",
          notes: notes?.trim() || `Séance de rattrapage — ${names}`,
          prixParSeance: groupe.prixParSeance ?? null,
        },
      });
      const createdPresences: any[] = [];
      const createdConsumptions: any[] = [];
      for (const el of eleves) {
        const p = await tx.presence.create({
          data: { seanceId: s.id, eleveId: el.id, statut: "present", enregistrePar: adminId },
        });
        const c = await consumeCourseAttendance(
          { centerId, eleveId: el.id, attendanceId: p.id, actorId: adminId },
          tx
        );
        createdPresences.push(p);
        createdConsumptions.push(c);
      }
      return { seance: s, presences: createdPresences, consumptions: createdConsumptions };
    });

    const when = heureDebut ? `le ${formatDateFr(date)} à ${heureDebut}` : `le ${formatDateFr(date)}`;
    const titre = "Séance de rattrapage ajoutée";
    const message = `Une séance a été ajoutée pour vous ${when} dans le groupe "${groupe.nom}". Elle est facturée ${price.toFixed(2)} DT (comptabilisée dans votre dossier).`;

    await prisma.notification.createMany({
      data: eleves.map((el) => ({
        centerId,
        destinataireId: el.id,
        titre,
        message,
        type: "nouvelle_seance",
      })),
    });
    await sendPushToUsers(eleveIdList, {
      title: titre,
      body: message,
      url: "/eleve/notifications",
    }).catch(() => {});

    logger.info("Séance de rattrapage ajoutée", {
      adminId,
      eleveIds: eleveIdList,
      seanceId: seance.id,
      groupeId,
      price,
    });

    return NextResponse.json({ seance, presences, consumptions }, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de l'ajout d'une séance de rattrapage", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
