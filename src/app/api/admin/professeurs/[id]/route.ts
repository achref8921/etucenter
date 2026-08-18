import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DEFAULT_CENTER_SHARE } from "@/lib/teacher-finance";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const { id } = await params;
    const centreId = (session.user as any).centerId;

    const month = request.nextUrl.searchParams.get("month");
    const now = new Date();
    const [yearStr, monthStr] = (month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).split("-");
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const professeur = await prisma.utilisateur.findUnique({
      where: { id, role: "prof", centerId: centreId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        image: true,
        dateNaissance: true,
        createdAt: true,
        updatedAt: true,
        tauxBenefice: { select: { tauxPourcentage: true } },
      },
    });

    if (!professeur) {
      return NextResponse.json({ error: "Professeur non trouvé" }, { status: 404 });
    }

    const taux = professeur.tauxBenefice
      ? Number(professeur.tauxBenefice.tauxPourcentage)
      : DEFAULT_CENTER_SHARE;

    const groupes = await prisma.groupe.findMany({
      where: { profId: id, centerId: centreId },
      include: {
        matiere: { select: { id: true, nom: true } },
        _count: { select: { inscriptions: true, seances: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const groupeIds = groupes.map((g) => g.id);

    const [netRevenueResult, eleveCounts] = await Promise.all([
      groupeIds.length
        ? prisma.$queryRawUnsafe<{ net_revenue: number }[]>(
            `
            WITH all_sessions AS (
              SELECT
                pr.eleve_id,
                s.groupe_id,
                COALESCE(s.prix_par_seance, g.prix_par_seance) as price,
                s.date as seance_date
              FROM presences pr
              JOIN seances s ON pr.seance_id = s.id
              JOIN groupes g ON s.groupe_id = g.id
              WHERE pr.statut = 'present'
                AND s.statut = 'terminee'
                AND g.prof_id = $1::uuid
                AND g.center_id = $2::uuid
                AND s.date <= $3::timestamptz
            ),
            student_dues AS (
              SELECT
                eleve_id, groupe_id,
                SUM(price) as total_due,
                SUM(CASE WHEN seance_date >= $4::timestamptz THEN price ELSE 0 END) as due_this_month
              FROM all_sessions
              GROUP BY eleve_id, groupe_id
            ),
            student_payments AS (
              SELECT
                pai.eleve_id,
                pai.groupe_id,
                SUM(pai.montant) as total_paid
              FROM paiements pai
              JOIN groupes g ON pai.groupe_id = g.id
              WHERE g.prof_id = $1::uuid
                AND g.center_id = $2::uuid
                AND pai.date_paiement <= $3::timestamptz
              GROUP BY pai.eleve_id, pai.groupe_id
            ),
            paid_this_month AS (
              SELECT
                sd.eleve_id,
                sd.groupe_id,
                GREATEST(0,
                  LEAST(sd.due_this_month,
                    GREATEST(0, COALESCE(sp.total_paid, 0) - (sd.total_due - sd.due_this_month))
                  )
                ) as paid_amount
              FROM student_dues sd
              LEFT JOIN student_payments sp
                ON sd.eleve_id = sp.eleve_id AND sd.groupe_id = sp.groupe_id
              WHERE sd.due_this_month > 0
            )
            SELECT COALESCE(SUM(pm.paid_amount), 0)::float as net_revenue
            FROM paid_this_month pm
            `,
            id,
            centreId,
            endDate,
            startDate
          )
        : [{ net_revenue: 0 }],
      groupeIds.length
        ? prisma.$queryRawUnsafe<{ groupe_id: string; eleve_id: string; nb: number }[]>(
            `
            SELECT i.groupe_id, i.eleve_id
            FROM inscriptions i
            JOIN groupes g ON i.groupe_id = g.id
            WHERE g.prof_id = $1::uuid AND g.center_id = $2::uuid AND i.statut = 'actif'
            `,
            id,
            centreId
          )
        : [],
    ]);

    const netRevenue = Number(netRevenueResult[0]?.net_revenue || 0);
    const beneficeCentre = (netRevenue * taux) / 100;
    const salaireProf = netRevenue - beneficeCentre;

    const uniqueStudentIds = new Set(eleveCounts.map((r) => r.eleve_id));
    const nombreEleves = uniqueStudentIds.size;

    const groupeStudentCounts = new Map<string, number>();
    for (const r of eleveCounts) {
      groupeStudentCounts.set(r.groupe_id, (groupeStudentCounts.get(r.groupe_id) || 0) + 1);
    }

    const seances = await prisma.seance.findMany({
      where: {
        groupe: { profId: id, centerId: centreId },
      },
      include: {
        groupe: { select: { id: true, nom: true } },
        _count: {
          select: {
            presences: { where: { statut: "present" } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const seancesWithStats = await Promise.all(
      seances.map(async (seance: any) => {
        const totalPresences = await prisma.presence.count({
          where: { seanceId: seance.id },
        });
        return {
          id: seance.id,
          date: seance.date,
          heureDebut: seance.heureDebut,
          heureFin: seance.heureFin,
          statut: seance.statut,
          notes: seance.notes,
          groupe: seance.groupe,
          stats: {
            presentsCount: seance._count.presences,
            totalEleves: totalPresences,
          },
        };
      })
    );

    const groupeFinancials: Record<string, {
      totalDue: number;
      totalPaid: number;
      unpaid: number;
      students: {
        eleveId: string;
        nom: string;
        prenom: string;
        presences: number;
        absences: number;
        totalDue: number;
        totalPaid: number;
        unpaid: number;
      }[];
    }> = {};

    if (groupeIds.length > 0) {
      const perStudentFinancials = await prisma.$queryRawUnsafe<{
        groupe_id: string;
        eleve_id: string;
        nom: string;
        prenom: string;
        presences: number;
        absences: number;
        total_due: number;
        total_paid: number;
      }[]>(
        `
        WITH group_presences AS (
          SELECT
            pr.eleve_id,
            pr.seance_id,
            pr.statut as presence_statut,
            s.groupe_id
          FROM presences pr
          JOIN seances s ON pr.seance_id = s.id
          JOIN groupes g ON s.groupe_id = g.id
          WHERE g.prof_id = $1::uuid AND g.center_id = $2::uuid AND s.statut = 'terminee'
        ),
        student_stats AS (
          SELECT
            gp.eleve_id,
            gp.groupe_id,
            COUNT(*) FILTER (WHERE gp.presence_statut = 'present') as presences,
            COUNT(*) FILTER (WHERE gp.presence_statut = 'absent') as absences
          FROM group_presences gp
          GROUP BY gp.eleve_id, gp.groupe_id
        ),
        student_dues AS (
          SELECT
            pr.eleve_id,
            s.groupe_id,
            COALESCE(s.prix_par_seance, g.prix_par_seance) * COUNT(*) as total_due
          FROM presences pr
          JOIN seances s ON pr.seance_id = s.id
          JOIN groupes g ON s.groupe_id = g.id
          WHERE pr.statut = 'present' AND s.statut = 'terminee'
            AND g.prof_id = $1::uuid AND g.center_id = $2::uuid
          GROUP BY pr.eleve_id, s.groupe_id, s.prix_par_seance, g.prix_par_seance
        ),
        student_payments AS (
          SELECT
            pai.eleve_id,
            pai.groupe_id,
            SUM(pai.montant) as total_paid
          FROM paiements pai
          JOIN groupes g ON pai.groupe_id = g.id
          WHERE g.prof_id = $1::uuid AND g.center_id = $2::uuid
          GROUP BY pai.eleve_id, pai.groupe_id
        )
        SELECT
          i.groupe_id,
          u.id as eleve_id,
          u.nom,
          u.prenom,
          COALESCE(ss.presences, 0) as presences,
          COALESCE(ss.absences, 0) as absences,
          COALESCE(sd.total_due, 0)::float as total_due,
          COALESCE(sp.total_paid, 0)::float as total_paid
        FROM inscriptions i
        JOIN groupes g ON i.groupe_id = g.id
        JOIN utilisateurs u ON i.eleve_id = u.id
        LEFT JOIN student_stats ss ON ss.eleve_id = i.eleve_id AND ss.groupe_id = i.groupe_id
        LEFT JOIN student_dues sd ON sd.eleve_id = i.eleve_id AND sd.groupe_id = i.groupe_id
        LEFT JOIN student_payments sp ON sp.eleve_id = i.eleve_id AND sp.groupe_id = i.groupe_id
        WHERE g.prof_id = $1::uuid AND g.center_id = $2::uuid AND i.statut = 'actif'
        ORDER BY u.nom, u.prenom
        `,
        id,
        centreId
      );

      for (const row of perStudentFinancials) {
        const gid = row.groupe_id;
        if (!groupeFinancials[gid]) {
          groupeFinancials[gid] = { totalDue: 0, totalPaid: 0, unpaid: 0, students: [] };
        }
        const due = Number(row.total_due || 0);
        const paid = Number(row.total_paid || 0);
        const unpaid = Math.max(0, due - paid);
        groupeFinancials[gid].totalDue += due;
        groupeFinancials[gid].totalPaid += paid;
        groupeFinancials[gid].unpaid += unpaid;
        groupeFinancials[gid].students.push({
          eleveId: row.eleve_id,
          nom: row.nom,
          prenom: row.prenom,
          presences: Number(row.presences || 0),
          absences: Number(row.absences || 0),
          totalDue: due,
          totalPaid: paid,
          unpaid,
        });
      }
    }

    logger.info("Détails professeur récupérés", {
      adminId: (session.user as any).id,
      professeurId: id,
    });

    return NextResponse.json({
      professeur,
      groupes,
      seances: seancesWithStats,
      finance: {
        taux,
        netRevenue,
        beneficeCentre,
        salaireProf,
        nombreEleves,
      },
      groupeFinancials,
    });
  } catch (err) {
    logger.error("Erreur lors de la récupération des détails professeur", { error: err });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
