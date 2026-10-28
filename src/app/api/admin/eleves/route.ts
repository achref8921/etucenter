import { NextResponse } from "next/server";
import { trackEventSafe } from "@/lib/analytics";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { attachHasImage } from "@/lib/user-images";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const eleves = await prisma.utilisateur.findMany({
      where: { role: "eleve", centerId, deletedAt: null, ghost: false },
      select: {
        id: true,
        nom: true,
        prenom: true,
        codeEleve: true,
        telephone: true,
        niveau: true,
        classe: true,
        filiere: true,
        inscriptions: {
          where: { statut: "actif" },
          select: {
            groupeId: true,
            forfaitMontant: true,
            forfaitSeances: true,
            forfaitSetAt: true,
            groupe: {
              select: {
                id: true,
                nom: true,
                prixParSeance: true,
              },
            },
          },
        },
      },
      orderBy: { nom: "asc" },
    });

    const pairEleves: string[] = [];
    const pairGroupes: string[] = [];
    for (const e of eleves) {
      for (const ins of e.inscriptions) {
        pairEleves.push(e.id);
        pairGroupes.push(ins.groupeId);
      }
    }

    const paidRows = pairEleves.length
      ? await prisma.$queryRawUnsafe<{ eleve_id: string; groupe_id: string; total: number }[]>(
          `
          SELECT p.eleve_id, p.groupe_id, SUM(p.montant)::float AS total
          FROM paiements p
          JOIN (SELECT unnest($1::uuid[]) AS eleve_id, unnest($2::uuid[]) AS groupe_id) x
            ON x.eleve_id = p.eleve_id AND x.groupe_id = p.groupe_id
          GROUP BY p.eleve_id, p.groupe_id
          `,
          pairEleves,
          pairGroupes
        )
      : [];

    const paidMap = new Map<string, number>();
    for (const row of paidRows) {
      paidMap.set(`${row.eleve_id}|${row.groupe_id}`, Number(row.total || 0));
    }

    const dueRows = pairEleves.length
      ? await prisma.$queryRawUnsafe<{ eleve_id: string; groupe_id: string; total: number }[]>(
          `
          SELECT pr.eleve_id, s.groupe_id,
            COALESCE(SUM(
              CASE
                WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
                THEN (i.forfait_montant / i.forfait_seances)
                ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
              END
            ), 0)::float AS total
          FROM presences pr
          JOIN seances s ON pr.seance_id = s.id
          JOIN groupes g ON s.groupe_id = g.id
          LEFT JOIN LATERAL (
            SELECT i2.forfait_montant, i2.forfait_seances
            FROM inscriptions i2
            WHERE i2.eleve_id = pr.eleve_id
              AND i2.groupe_id = g.id
              AND (
                i2.statut = 'actif'
                OR (i2.date_fin IS NOT NULL AND i2.date_debut <= s.date AND i2.date_fin >= s.date)
              )
            ORDER BY
              CASE WHEN i2.date_fin IS NOT NULL AND i2.date_debut <= s.date AND i2.date_fin >= s.date THEN 0 ELSE 1 END,
              CASE WHEN i2.statut = 'actif' THEN 0 ELSE 1 END,
              i2.date_debut DESC NULLS LAST
            LIMIT 1
          ) i ON TRUE
          WHERE pr.statut = 'present' AND s.statut <> 'annulee'
            AND pr.eleve_id = ANY($1::uuid[]) AND s.groupe_id = ANY($2::uuid[])
          GROUP BY pr.eleve_id, s.groupe_id
          `,
          pairEleves,
          pairGroupes
        )
      : [];

    const dueMap = new Map<string, number>();
    for (const row of dueRows) {
      dueMap.set(`${row.eleve_id}|${row.groupe_id}`, Number(row.total || 0));
    }

    const result = eleves.map((e) => {
      const groupes = e.inscriptions.map((ins) => {
        const effectivePrix = ins.forfaitMontant != null && ins.forfaitSeances
          ? Number(ins.forfaitMontant) / Number(ins.forfaitSeances)
          : Number(ins.groupe.prixParSeance);
        const totalDue = dueMap.get(`${e.id}|${ins.groupeId}`) || 0;
        const totalPaid = paidMap.get(`${e.id}|${ins.groupeId}`) || 0;
        return {
          groupe: { id: ins.groupe.id, nom: ins.groupe.nom, prixParSeance: effectivePrix },
          totalDue,
          totalPaid,
          unpaid: totalDue - totalPaid,
        };
      });
      return { id: e.id, nom: e.nom, prenom: e.prenom, codeEleve: e.codeEleve, telephone: e.telephone, niveau: e.niveau, classe: e.classe, filiere: e.filiere, groupes };
    });

    const withAvatars = await attachHasImage(result);

    void trackEventSafe({
      userId: (session.user as any).id,
      centerId,
      event: "STUDENT_VIEWED",
      path: "/admin/eleves",
      feature: "Élèves",
      metadata: { count: result.length },
    });

    return NextResponse.json(withAvatars);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
