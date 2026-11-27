-- 17 : rappels d'abonnement, compteur de jours et suspension automatique.
-- `paid_at`     : date réelle d'encaissement (base du compteur mensuel).
-- `duree`       : mois / trimestre / année, pour l'affichage du cycle.
-- `subscription_suspended_at` : date de gel automatique du centre pour
--   abonnement impayé (permet de distinguer une désactivation manuelle).

ALTER TABLE "center_subscriptions" ADD COLUMN "paid_at" TIMESTAMP(3);
ALTER TABLE "center_subscriptions" ADD COLUMN "duree" VARCHAR(20);

ALTER TABLE "centers" ADD COLUMN "subscription_suspended_at" TIMESTAMP(3);

CREATE INDEX "center_subscriptions_paid_at_idx" ON "center_subscriptions"("paid_at");
