-- 11 : figer la répartition centre / prof au moment de chaque paiement élève.
-- Objectif : un changement de taux (section bénéfices) ne doit JAMAIS modifier
-- les calculs passés ; il ne s'applique qu'à partir du moment du changement.

ALTER TABLE "paiements" ADD COLUMN "taux_applique" DECIMAL(5, 2);
ALTER TABLE "paiements" ADD COLUMN "part_centre" DECIMAL(10, 2);

-- Backfill des paiements existants avec le taux en vigueur du prof
-- (l'historique applicatif utilisait déjà ce taux).
UPDATE "paiements" pa
SET "taux_applique" = COALESCE(tb.taux_pourcentage, 20),
    "part_centre" = ROUND((pa.montant * COALESCE(tb.taux_pourcentage, 20)) / 100, 2)
FROM "groupes" g
LEFT JOIN "taux_benefices" tb ON tb.prof_id = g.prof_id
WHERE g.id = pa.groupe_id
  AND g.prof_id IS NOT NULL;
