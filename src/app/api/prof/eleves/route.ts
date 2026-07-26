import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "prof") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Get all groups this teacher teaches
    const groupes = await prisma.groupe.findMany({
      where: { profId: userId },
      include: {
        matiere: { select: { id: true, nom: true } },
        _count: { select: { seances: true } },
      },
    });

    const groupeIds = groupes.map((g) => g.id);

    // Get all inscriptions in those groups
    const inscriptions = await prisma.inscription.findMany({
      where: {
        groupeId: { in: groupeIds },
        statut: "actif",
      },
      include: {
        eleve: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
            codeEleve: true,
            niveau: true,
            classe: true,
            filiere: true,
            dateNaissance: true,
          },
        },
        groupe: {
          select: {
            id: true,
            nom: true,
            prixParSeance: true,
            matiere: { select: { nom: true } },
          },
        },
      },
    });

    // Group by student
    const studentMap = new Map<string, any>();

    for (const insc of inscriptions) {
      const stId = insc.eleveId;
      if (!studentMap.has(stId)) {
        studentMap.set(stId, {
          ...insc.eleve,
          groupes: [],
        });
      }
      studentMap.get(stId)!.groupes.push({
        id: insc.groupe.id,
        nom: insc.groupe.nom,
        matiere: insc.groupe.matiere?.nom || "—",
        prixParSeance: Number(insc.groupe.prixParSeance),
      });
    }

    const studentIds = Array.from(studentMap.keys());

    // Get payment totals per student per group
    const paiements = await prisma.paiement.groupBy({
      by: ["eleveId", "groupeId"],
      where: {
        eleveId: { in: studentIds },
        groupeId: { in: groupeIds },
      },
      _sum: { montant: true },
      _count: { id: true },
    });

    // Get attendance per student per group
    const presenceData = await prisma.$queryRawUnsafe(
      `SELECT pr.eleve_id, s.groupe_id,
              COUNT(*)::int as total_seances,
              SUM(CASE WHEN pr.statut = 'present' THEN 1 ELSE 0 END)::int as present_count,
              SUM(CASE WHEN pr.statut = 'absent' THEN 1 ELSE 0 END)::int as absent_count
       FROM presences pr
       JOIN seances s ON pr.seance_id = s.id
       WHERE pr.eleve_id = ANY($1::uuid[]) AND s.groupe_id = ANY($2::uuid[]) AND s.statut = 'terminee'
       GROUP BY pr.eleve_id, s.groupe_id`,
      studentIds,
      groupeIds
    );

    // Get finished seances count per group for unpaid calculation
    const finishedSeances = await prisma.seance.groupBy({
      by: ["groupeId"],
      where: {
        groupeId: { in: groupeIds },
        statut: "terminee",
      },
      _count: { id: true },
    });

    const finishedSeanceMap = new Map<string, number>();
    for (const fs of finishedSeances) {
      finishedSeanceMap.set(fs.groupeId, fs._count.id);
    }

    // Build payment map
    const paymentMap = new Map<string, number>();
    for (const pay of paiements) {
      const key = `${pay.eleveId}-${pay.groupeId}`;
      paymentMap.set(key, Number(pay._sum.montant || 0));
    }

    // Build presence map
    const presenceMap = new Map<string, { total: number; present: number; absent: number }>();
    for (const p of presenceData as any[]) {
      const key = `${p.eleve_id}-${p.groupe_id}`;
      presenceMap.set(key, { total: p.total_seances, present: p.present_count, absent: p.absent_count });
    }

    // Build final result
    const result = [];
    for (const [stId, student] of studentMap) {
      let totalDue = 0;
      let totalPaid = 0;
      const groupeDetails = [];

      for (const grp of student.groupes) {
        const finishedCount = finishedSeanceMap.get(grp.id) || 0;
        const due = grp.prixParSeance;
        const paid = paymentMap.get(`${stId}-${grp.id}`) || 0;
        const pres = presenceMap.get(`${stId}-${grp.id}`) || { total: 0, present: 0, absent: 0 };

        totalDue += due;
        totalPaid += paid;

        groupeDetails.push({
          ...grp,
          seancesTotalies: finishedCount,
          impaye: Math.max(0, due - paid),
          presences: pres.present,
          absences: pres.absent,
          tauxPresence: pres.total > 0 ? Math.round((pres.present / pres.total) * 100) : 0,
        });
      }

      result.push({
        ...student,
        groupes: groupeDetails,
        totalDue,
        totalPaid,
        impayeTotal: Math.max(0, totalDue - totalPaid),
      });
    }

    // Sort by unpaid descending
    result.sort((a, b) => b.impayeTotal - a.impayeTotal);

    logger.info("Eleves prof récupérés", { userId, count: result.length });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Erreur lors de la récupération des eleves", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
