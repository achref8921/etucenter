import { prisma } from "./prisma";
import { round2 } from "./teacher-finance";

export interface StudentOverGroupPrice {
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  eleveCode: string | null;
  eleveClasse: string | null;
  groupeId: string;
  groupeNom: string;
  matiereNom: string | null;
  profId: string | null;
  profNom: string | null;
  profPrenom: string | null;
  prixSeance: number;
  totalDue: number;
  totalPaid: number;
  impaye: number;
  excedent: number;
}

/**
 * Liste les couples (élève, groupe) dont l'impayé dépasse le prix d'une séance
 * du groupe (prix_par_seance).
 *
 * Le calcul du dû reprend exactement la logique de `getUnpaidStudents` :
 *   - seules les présences `present` comptent ;
 *   - les séances annulées sont exclues ;
 *   - le tarif suit le forfait de l'inscription quand il existe ;
 *   - le montant payé correspond à la somme des paiements du couple.
 *
 * Aucune condition sur le nombre de séances restantes : un élève qui doit
 * 130 DT pour un groupe à 120 DT apparaît, même s'il lui reste des séances.
 */
export async function getStudentsOverGroupPrice(params: {
  centerId: string;
  profId?: string | null;
}): Promise<StudentOverGroupPrice[]> {
  const { centerId, profId } = params;

  const rows = await prisma.$queryRawUnsafe<
    {
      eleve_id: string;
      groupe_id: string;
      unpaid: number;
      due_total: number;
      paid_total: number;
      prix_par_seance: number;
      nom: string;
      prenom: string;
      code_eleve: string | null;
      classe: string | null;
      groupe_nom: string;
      matiere_nom: string | null;
      prof_id: string | null;
      prof_nom: string | null;
      prof_prenom: string | null;
    }[]
  >(
    `
    WITH due AS (
      SELECT pr.eleve_id, s.groupe_id,
        SUM(
          CASE
            WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
            THEN (i.forfait_montant / i.forfait_seances)
            ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
          END
        ) AS due_total
      FROM presences pr
      JOIN seances s ON pr.seance_id = s.id
      JOIN groupes g ON s.groupe_id = g.id
      LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
      WHERE pr.statut = 'present' AND s.statut <> 'annulee' AND g.center_id = $1::uuid
        AND ($2::uuid IS NULL OR g.prof_id = $2::uuid)
      GROUP BY pr.eleve_id, s.groupe_id
    ),
    paid AS (
      SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) AS paid_total
      FROM paiements pai
      JOIN groupes g2 ON pai.groupe_id = g2.id
      WHERE g2.center_id = $1::uuid
      GROUP BY pai.eleve_id, pai.groupe_id
    )
    SELECT due.eleve_id, due.groupe_id,
           (due.due_total - COALESCE(paid.paid_total, 0))::float AS unpaid,
           due.due_total::float AS due_total,
           COALESCE(paid.paid_total, 0)::float AS paid_total,
           g.prix_par_seance::float AS prix_par_seance,
           u.nom, u.prenom, u.code_eleve, u.classe,
           g.nom AS groupe_nom, m.nom AS matiere_nom,
           p.id AS prof_id, p.nom AS prof_nom, p.prenom AS prof_prenom
    FROM due
    JOIN utilisateurs u ON u.id = due.eleve_id
      AND u.role = 'eleve' AND u.deleted_at IS NULL AND u.ghost = false
    JOIN groupes g ON g.id = due.groupe_id
    LEFT JOIN matieres m ON m.id = g.matiere_id
    LEFT JOIN utilisateurs p ON p.id = g.prof_id
    LEFT JOIN paid ON paid.eleve_id = due.eleve_id AND paid.groupe_id = due.groupe_id
    WHERE due.due_total > COALESCE(paid.paid_total, 0)
      AND g.prix_par_seance > 0
      AND (due.due_total - COALESCE(paid.paid_total, 0)) > g.prix_par_seance
    ORDER BY unpaid DESC
    `,
    centerId,
    profId ?? null
  );

  return rows.map((row) => {
    const impaye = round2(Number(row.unpaid || 0));
    const prixSeance = round2(Number(row.prix_par_seance || 0));
    return {
      eleveId: row.eleve_id,
      eleveNom: row.nom,
      elevePrenom: row.prenom,
      eleveCode: row.code_eleve,
      eleveClasse: row.classe,
      groupeId: row.groupe_id,
      groupeNom: row.groupe_nom,
      matiereNom: row.matiere_nom,
      profId: row.prof_id,
      profNom: row.prof_nom,
      profPrenom: row.prof_prenom,
      prixSeance,
      totalDue: round2(Number(row.due_total || 0)),
      totalPaid: round2(Number(row.paid_total || 0)),
      impaye,
      excedent: round2(impaye - prixSeance),
    };
  });
}
