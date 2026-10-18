import { NextResponse } from "next/server";
import { requireActiveCenter, ELEVE_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateTotalDue, calculateTotalPaid, calculateUnpaid } from "@/lib/calculations";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ELEVE_ROLES);
    if (error) return error;

    const eleveId = (session.user as any).id;

    const inscriptions = await prisma.inscription.findMany({
      where: {
        eleveId,
        statut: "actif",
      },
      include: {
        groupe: {
          include: {
            prof: {
              select: { id: true, nom: true, prenom: true, telephone: true, email: true },
            },
            matiere: {
              select: { id: true, nom: true },
            },
          },
        },
      },
      orderBy: { dateInscription: "desc" },
    });

    const groupeIds = inscriptions.map((i: any) => i.groupeId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [seances, presences] = groupeIds.length
      ? await Promise.all([
          prisma.seance.findMany({
            where: { groupeId: { in: groupeIds } },
            select: { id: true, groupeId: true, date: true, statut: true },
            orderBy: { date: "desc" },
          }),
          prisma.presence.findMany({
            where: { eleveId },
            select: {
              statut: true,
              dateCreation: true,
              seance: { select: { id: true, groupeId: true, date: true } },
            },
          }),
        ])
      : [[], []];

    const seancesByGroupe = new Map<string, typeof seances>();
    for (const s of seances) {
      const list = seancesByGroupe.get(s.groupeId) ?? [];
      list.push(s);
      seancesByGroupe.set(s.groupeId, list);
    }

    const presencesByGroupe = new Map<string, typeof presences>();
    for (const p of presences) {
      const list = presencesByGroupe.get(p.seance.groupeId) ?? [];
      list.push(p);
      presencesByGroupe.set(p.seance.groupeId, list);
    }

    const groupesWithStats = await Promise.all(
      inscriptions.map(async (inscription: any) => {
        const [totalDue, totalPaid, unpaid] = await Promise.all([
          calculateTotalDue(eleveId, inscription.groupeId),
          calculateTotalPaid(eleveId, inscription.groupeId),
          calculateUnpaid(eleveId, inscription.groupeId),
        ]);

        const groupeSeances = seancesByGroupe.get(inscription.groupeId) ?? [];
        const groupePresences = presencesByGroupe.get(inscription.groupeId) ?? [];

        return {
          inscription: {
            id: inscription.id,
            dateInscription: inscription.dateInscription,
            statut: inscription.statut,
          },
          groupe: inscription.groupe,
          effectivePrixParSeance: inscription.forfaitMontant != null && inscription.forfaitSeances
            ? Number(inscription.forfaitMontant) / Number(inscription.forfaitSeances)
            : Number(inscription.groupe.prixParSeance),
          stats: {
            totalDue,
            totalPaid,
            remainingCredit: totalPaid - totalDue,
            unpaid,
          },
          seances: {
            total: groupeSeances.length,
            aVenir: groupeSeances.filter((s: any) => new Date(s.date) >= today && s.statut !== "annulee").length,
            // Liste des séances du groupe (hors annulées) : utilisée par
            // l'écran « Mes groupes » pour ouvrir les supports de la séance.
            // Ce champ est purely additif, les compteurs ci-dessus sont
            // inchangés. L'accès aux supports reste revérifié côté serveur via
            // l'inscription active.
            liste: groupeSeances
              .filter((s: any) => s.statut !== "annulee")
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((s: any) => ({ id: s.id, date: s.date, statut: s.statut })),
          },
          presences: {
            present: groupePresences.filter((p: any) => p.statut === "present").length,
            absent: groupePresences.filter((p: any) => p.statut === "absent").length,
          },
        };
      })
    );

    logger.info("Groupes élève récupérés", { eleveId, count: groupesWithStats.length });

    return NextResponse.json(groupesWithStats);
  } catch (error) {
    logger.error("Erreur lors de la récupération des groupes élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
