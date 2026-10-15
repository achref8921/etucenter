-- 12 : tracer les encaissements réalisés par le professeur (collecte inverse).
-- Objectif : documenter ces encaissements comme de véritables paiements élève
-- (même répartition centre/prof, même impact sur le solde de l'élève), tout en
-- les distinguant des paiements reçus directement par le centre afin que la part
-- centre ne soit comptabilisée dans les bénéfices qu'une fois le professeur
-- réglé celle-ci au centre.

ALTER TABLE "paiements" ADD COLUMN "collecte_par_prof" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "paiements" ADD COLUMN "reverse_debt_id" UUID;

CREATE INDEX "paiements_collecte_par_prof_idx" ON "paiements"("collecte_par_prof");
CREATE INDEX "paiements_reverse_debt_idx" ON "paiements"("reverse_debt_id");