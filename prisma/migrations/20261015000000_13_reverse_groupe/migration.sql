-- 13 : rattacher la collecte inverse au GROUPE de l'élève (et non à une séance).
-- Le professeur sélectionne le groupe suivi par l'élève ; la séance n'est plus
-- pertinente pour un encaissement. On conserve seance_id (nullable) pour
-- l'historique et on ajoute groupe_id sur la dette et sur les transactions prof.
-- Les lignes existantes (qui pointaient vers une séance) sont rétro-remplies
-- avec le groupe de cette séance.

ALTER TABLE "teacher_center_debts" ADD COLUMN "groupe_id" UUID;
ALTER TABLE "teacher_transactions" ADD COLUMN "groupe_id" UUID;

CREATE INDEX "teacher_center_debts_groupe_id_idx" ON "teacher_center_debts"("groupe_id");
CREATE INDEX "teacher_transactions_groupe_id_idx" ON "teacher_transactions"("groupe_id");

ALTER TABLE "teacher_center_debts" ADD CONSTRAINT "teacher_center_debts_groupe_id_fkey"
  FOREIGN KEY ("groupe_id") REFERENCES "groupes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teacher_transactions" ADD CONSTRAINT "teacher_transactions_groupe_id_fkey"
  FOREIGN KEY ("groupe_id") REFERENCES "groupes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rétro-remplissage : les anciennes lignes ont un seance_id, dont on déduit le groupe.
UPDATE "teacher_center_debts" d
SET "groupe_id" = s."groupe_id"
FROM "seances" s
WHERE d."seance_id" = s."id" AND d."groupe_id" IS NULL;

UPDATE "teacher_transactions" t
SET "groupe_id" = s."groupe_id"
FROM "seances" s
WHERE t."seance_id" = s."id" AND t."groupe_id" IS NULL;
