import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { repartitionSchema } from "@/lib/validations";
import { executeRepartition, RepartitionError } from "@/lib/groupe-repartition";
import { todayDateInputValue } from "@/lib/utils";

/**
 * Données nécessaires à l'écran de réorganisation : groupes, élèves actifs,
 * attributs tarifaires et volume d'historique de chaque groupe.
 */
export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const today = new Date(`${todayDateInputValue()}T00:00:00.000Z`);

    const [groupes, profs, matieres, futures, seancesCount, paiementsCount] = await Promise.all([
      prisma.groupe.findMany({
        where: { centerId },
        select: {
          id: true,
          nom: true,
          statut: true,
          profId: true,
          matiereId: true,
          prixParSeance: true,
          forfaitMontant: true,
          forfaitSeances: true,
          capaciteMax: true,
          prof: { select: { id: true, nom: true, prenom: true } },
          matiere: { select: { id: true, nom: true } },
          inscriptions: {
            where: { statut: "actif", eleve: { deletedAt: null, ghost: false } },
            select: {
              id: true,
              eleveId: true,
              forfaitMontant: true,
              forfaitSeances: true,
              dateInscription: true,
              eleve: {
                select: { id: true, nom: true, prenom: true, codeEleve: true, classe: true },
              },
            },
            orderBy: { eleve: { nom: "asc" } },
          },
        },
        orderBy: [{ statut: "asc" }, { nom: "asc" }],
      }),
      prisma.utilisateur.findMany({
        where: { centerId, role: "prof", deletedAt: null },
        select: { id: true, nom: true, prenom: true },
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      }),
      prisma.matiere.findMany({
        where: { centerId },
        select: { id: true, nom: true },
        orderBy: { nom: "asc" },
      }),
      prisma.seance.groupBy({
        by: ["groupeId"],
        where: { groupe: { centerId }, date: { gt: today }, statut: "planifiee" },
        _count: { _all: true },
      }),
      prisma.seance.groupBy({
        by: ["groupeId"],
        where: { groupe: { centerId } },
        _count: { _all: true },
      }),
      prisma.paiement.groupBy({
        by: ["groupeId"],
        where: { groupe: { centerId } },
        _count: { _all: true },
        _sum: { montant: true },
      }),
    ]);

    const futuresMap = new Map(futures.map((f) => [f.groupeId, f._count._all]));
    const seancesMap = new Map(seancesCount.map((s) => [s.groupeId, s._count._all]));
    const paiementsMap = new Map(
      paiementsCount.map((p) => [p.groupeId, { count: p._count._all, montant: Number(p._sum.montant ?? 0) }])
    );

    return NextResponse.json({
      today: todayDateInputValue(),
      groupes: groupes.map((g) => ({
        id: g.id,
        nom: g.nom,
        statut: g.statut,
        profId: g.profId,
        prof: g.prof,
        matiereId: g.matiereId,
        matiere: g.matiere,
        prixParSeance: Number(g.prixParSeance),
        forfaitMontant: g.forfaitMontant != null ? Number(g.forfaitMontant) : null,
        forfaitSeances: g.forfaitSeances,
        capaciteMax: g.capaciteMax,
        eleves: g.inscriptions.map((i) => ({
          eleveId: i.eleveId,
          inscriptionId: i.id,
          forfaitMontant: i.forfaitMontant != null ? Number(i.forfaitMontant) : null,
          forfaitSeances: i.forfaitSeances,
          dateInscription: i.dateInscription,
          nom: i.eleve.nom,
          prenom: i.eleve.prenom,
          codeEleve: i.eleve.codeEleve,
          classe: i.eleve.classe,
        })),
        stats: {
          seances: seancesMap.get(g.id) ?? 0,
          seancesFutures: futuresMap.get(g.id) ?? 0,
          paiements: paiementsMap.get(g.id)?.count ?? 0,
          paiementsMontant: paiementsMap.get(g.id)?.montant ?? 0,
        },
      })),
      profs,
      matieres,
    });
  } catch (error) {
    logger.error("Erreur lors du chargement des données de réorganisation", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method, ADMIN_ROLES);
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }

    const parsed = repartitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const admin = session.user as any;

    const result = await executeRepartition({
      centerId: admin.centerId,
      actorId: admin.id,
      input: parsed.data,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RepartitionError) {
      logger.warn("Réorganisation refusée", { message: error.message, status: error.status });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const prismaCode = (error as { code?: string })?.code;
    if (prismaCode === "P2002") {
      return NextResponse.json(
        { error: "Conflit : un élève possède déjà une inscription ouverte dans le groupe cible" },
        { status: 409 }
      );
    }
    if (prismaCode === "P2034") {
      return NextResponse.json(
        { error: "Opération concurrente détectée, veuillez réessayer" },
        { status: 409 }
      );
    }
    logger.error("Erreur lors de la réorganisation des groupes", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
