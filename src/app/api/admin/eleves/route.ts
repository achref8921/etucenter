import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const eleves = await prisma.utilisateur.findMany({
      where: { role: "eleve", centerId, deletedAt: null },
      select: {
        id: true,
        nom: true,
        prenom: true,
        codeEleve: true,
        niveau: true,
        classe: true,
        filiere: true,
        inscriptions: {
          where: { statut: "actif" },
          select: {
            groupeId: true,
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

    const presentRows = pairEleves.length
      ? await prisma.$queryRawUnsafe<{ eleve_id: string; groupe_id: string; n: number }[]>(
          `
          SELECT pr.eleve_id, s.groupe_id, COUNT(*)::int AS n
          FROM presences pr
          JOIN seances s ON pr.seance_id = s.id
          WHERE pr.statut = 'present' AND s.statut = 'terminee'
            AND pr.eleve_id = ANY($1::uuid[]) AND s.groupe_id = ANY($2::uuid[])
          GROUP BY pr.eleve_id, s.groupe_id
          `,
          pairEleves,
          pairGroupes
        )
      : [];

    const presentMap = new Map<string, number>();
    for (const row of presentRows) {
      presentMap.set(`${row.eleve_id}|${row.groupe_id}`, Number(row.n || 0));
    }

    const result = eleves.map((e) => {
      const groupes = e.inscriptions.map((ins) => {
        const prixParSeance = Number(ins.groupe.prixParSeance);
        const totalDue = prixParSeance * (presentMap.get(`${e.id}|${ins.groupeId}`) || 0);
        const totalPaid = paidMap.get(`${e.id}|${ins.groupeId}`) || 0;
        return {
          groupe: { id: ins.groupe.id, nom: ins.groupe.nom, prixParSeance },
          totalDue,
          totalPaid,
          unpaid: totalDue - totalPaid,
        };
      });
      return { id: e.id, nom: e.nom, prenom: e.prenom, codeEleve: e.codeEleve, niveau: e.niveau, classe: e.classe, filiere: e.filiere, groupes };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
