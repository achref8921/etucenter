import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateStudentStats } from "@/lib/calculations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;

    const centreId = (session.user as any).centerId;

    const eleve = await prisma.utilisateur.findUnique({
      where: { id, role: "eleve", centerId: centreId, deletedAt: null },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        image: true,
        codeEleve: true,
        niveau: true,
        classe: true,
        filiere: true,
        dateNaissance: true,
        actif: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const inscriptions = await prisma.inscription.findMany({
      where: { eleveId: id },
      include: {
        groupe: {
          select: {
            id: true,
            nom: true,
            profId: true,
            prixParSeance: true,
            prof: {
              select: { id: true, nom: true, prenom: true },
            },
            matiere: {
              select: { id: true, nom: true },
            },
          },
        },
      },
      orderBy: { dateInscription: "desc" },
    });

    const studentStats = await calculateStudentStats(id);
    const statsMap = new Map(studentStats.map((s) => [s.groupeId, s]));

    const inscriptionsWithStats = inscriptions.map((inscription) => {
      const stats = statsMap.get(inscription.groupeId);
      return {
        id: inscription.id,
        dateInscription: inscription.dateInscription,
        statut: inscription.statut,
        forfaitMontant: inscription.forfaitMontant,
        forfaitSeances: inscription.forfaitSeances,
        forfaitSetAt: inscription.forfaitSetAt,
        groupe: inscription.groupe,
        stats: stats
          ? {
              presencesCount: stats.presencesCount,
              absencesCount: stats.absencesCount,
              totalDue: stats.totalDue,
              totalPaid: stats.totalPaid,
              unpaid: stats.unpaid,
            }
          : { presencesCount: 0, absencesCount: 0, totalDue: 0, totalPaid: 0, unpaid: 0 },
      };
    });

    const [paiements, presences] = await Promise.all([
      prisma.paiement.findMany({
        where: { eleveId: id },
        include: {
          groupe: {
            select: { id: true, nom: true },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),
      prisma.presence.findMany({
        where: { eleveId: id },
        select: {
          id: true,
          statut: true,
          seance: {
            select: {
              id: true,
              date: true,
              statut: true,
              groupe: {
                select: {
                  id: true,
                  nom: true,
                  matiere: { select: { nom: true } },
                  prof: { select: { id: true, nom: true, prenom: true } },
                },
              },
            },
          },
        },
        orderBy: { seance: { date: "desc" } },
      }),
    ]);

    logger.info("Détails élève récupérés", {
      adminId: (session.user as any).id,
      eleveId: id,
    });

    return NextResponse.json({ eleve, inscriptions: inscriptionsWithStats, paiements, presences });
  } catch (error) {
    logger.error("Erreur lors de la récupération des détails élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("PATCH", ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;
    const centreId = (session.user as any).centerId;

    const eleve = await prisma.utilisateur.findUnique({
      where: { id, role: "eleve", centerId: centreId, deletedAt: null },
      select: { id: true, nom: true, prenom: true, niveau: true, classe: true, filiere: true, centerId: true },
    });

    if (!eleve) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const { niveau, classe, filiere } = body || {};

    if (niveau === undefined && classe === undefined && filiere === undefined) {
      return NextResponse.json({ error: "aucun champ à modifier (niveau, classe, filiere)" }, { status: 400 });
    }

    const validNiveaux = ["primaire", "college", "lycee"];
    const validFilieres = ["lettres", "economique", "informatique", "technique", "sciences", "math"];

    if (niveau !== undefined && !validNiveaux.includes(niveau)) {
      return NextResponse.json({ error: "Niveau scolaire invalide" }, { status: 400 });
    }
    if (classe !== undefined && (typeof classe !== "string" || !classe.trim())) {
      return NextResponse.json({ error: "Classe invalide" }, { status: 400 });
    }
    if (filiere !== undefined && !validFilieres.includes(filiere)) {
      return NextResponse.json({ error: "Filière invalide" }, { status: 400 });
    }

    const finalNiveau = niveau !== undefined ? niveau : eleve.niveau;
    const finalClasse = classe !== undefined ? classe : eleve.classe;
    const finalFiliere = filiere !== undefined ? filiere : eleve.filiere;

    if ((niveau !== undefined || classe !== undefined) && finalNiveau && !finalClasse) {
      return NextResponse.json({ error: "Le niveau et la classe sont requis pour les élèves" }, { status: 400 });
    }
    const lyceeClasses = ["2ème", "3ème", "Bac"];
    if (finalNiveau === "lycee" && finalClasse && lyceeClasses.includes(finalClasse) && !finalFiliere) {
      return NextResponse.json({ error: "La filière est requise pour le lycée (2ème, 3ème, Bac)" }, { status: 400 });
    }

    const data: any = {};
    if (niveau !== undefined) data.niveau = niveau;
    if (classe !== undefined) data.classe = classe;
    if (filiere !== undefined) data.filiere = filiere;

    const updated = await prisma.utilisateur.update({
      where: { id },
      data,
      select: { id: true, nom: true, prenom: true, niveau: true, classe: true, filiere: true },
    });

    logger.info("Niveau scolaire de l'élève modifié", {
      adminId: (session.user as any).id,
      eleveId: id,
      niveau,
      classe,
      filiere,
    });

    try {
      await prisma.systemLog.create({
        data: {
          action: "eleve_niveau_updated",
          entity: "utilisateur",
          entityId: id,
          details: { centerId: centreId, niveau, classe, filiere },
          userId: (session.user as any).id,
        },
      });
    } catch (logError) {
      logger.error("Echec du journal systemLog du changement de niveau", { logError });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error("Erreur lors de la modification du niveau de l'élève", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
