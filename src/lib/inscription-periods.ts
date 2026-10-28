import { Prisma } from "@prisma/client";

/**
 * Membres d'un groupe À UNE DATE donnée.
 *
 * Une réorganisation de groupe (scission / fusion) ferme les périodes
 * d'inscription d'origine : le filtre `statut = 'actif'` ne suffit donc plus
 * pour retrouver les élèves d'une séance passée. On accepte ici la période
 * ouverte (statut actif) ET toute période fermée qui couvre la date visée.
 *
 * Aucune donnée financière n'est lue ni modifiée ici : il s'agit uniquement de
 * reconstituer la liste des élèves présents dans le groupe ce jour-là.
 */
export function inscriptionsAtDateWhere(
  groupeId: string,
  date: Date
): Prisma.InscriptionWhereInput {
  return {
    groupeId,
    OR: [
      { statut: "actif" },
      { dateDebut: { lte: date }, dateFin: { gte: date } },
    ],
  };
}

function dayValue(value: Date | string): number {
  const d = typeof value === "string" ? new Date(value) : value;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Une seule inscription par élève : la période fermée qui couvre la date de la
 * séance est prioritaire, sinon la période ouverte.
 */
export function dedupeInscriptionsAtDate<
  T extends {
    eleveId: string;
    statut: string;
    dateDebut: Date | string;
    dateFin: Date | string | null;
  }
>(rows: T[], date: Date): T[] {
  const day = dayValue(date);
  const score = (row: T): number => {
    if (row.dateFin != null && dayValue(row.dateDebut) <= day && dayValue(row.dateFin) >= day) {
      return 2;
    }
    return row.statut === "actif" ? 1 : 0;
  };

  const best = new Map<string, T>();
  for (const row of rows) {
    const current = best.get(row.eleveId);
    if (!current || score(row) > score(current)) best.set(row.eleveId, row);
  }
  return [...best.values()];
}
