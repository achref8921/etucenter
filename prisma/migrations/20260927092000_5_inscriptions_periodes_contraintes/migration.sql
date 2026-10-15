-- =============================================================================
-- Migration 5/9 — PÉRIODES D'INSCRIPTION : CONTRAINTES ET INDEX
-- -----------------------------------------------------------------------------
-- Cette migration n'écrit AUCUNE ligne métier : uniquement des contraintes,
-- des valeurs par défaut et des index. Elle est sûre parce que la migration 4 a
-- déjà rempli les colonnes.
--
-- La contrainte de cohérence des bornes (CHECK) est volontairement reportée dans
-- la migration 6 : elle est appliquée après le déploiement du code applicatif
-- qui sait gérer les périodes, afin de ne pas bloquer la réactivation des
-- périodes legacy 'inconnu' pendant la fenêtre de déploiement.
--
-- ⚠️ C'est la SEULE migration qui retire une contrainte existante :
--    DROP INDEX "inscriptions_eleve_id_groupe_id_key"
--    C'est nécessaire pour permettre A -> B -> A (réinscription dans le même
--    groupe) et le multi-groupe. La garantie de remplacement est STRICTE ET
--    PLUS FORTE : une seule période OUVERTE par couple, au lieu d'une seule
--    ligne par couple.
-- =============================================================================

-- AlterTable : valeurs par défaut et non-nullité
-- "date_debut" reçoit CURRENT_TIMESTAMP, casté en DATE par PostgreSQL, donc la
-- date du jour pour une nouvelle inscription.
ALTER TABLE "inscriptions" ALTER COLUMN "date_debut" SET DEFAULT CURRENT_TIMESTAMP;

-- Le backfill de la migration 4 garantit l'absence de NULL ; sinon cet ALTER échoue.
ALTER TABLE "inscriptions" ALTER COLUMN "date_debut" SET NOT NULL;

ALTER TABLE "inscriptions" ALTER COLUMN "date_debut_source" SET DEFAULT 'inscription';

ALTER TABLE "inscriptions" ALTER COLUMN "date_debut_source" SET NOT NULL;

ALTER TABLE "inscriptions" ALTER COLUMN "updated_at" SET NOT NULL;

-- =============================================================================
-- Remplacement du UNIQUE (eleve_id, groupe_id)
-- ancien : au plus UNE ligne par couple, toutes périodes confondues
-- nouveau : au plus UNE période OUVERTE par couple ; l'historique est conservé
--
-- La création ne peut pas échouer : l'ancien index unique garantit qu'il
-- n'existe pas deux lignes 'actif' pour un même couple (mesuré : 0 conflit sur
-- 170 périodes actives).
--
-- Pourquoi "WHERE statut = 'actif'" et non "WHERE date_fin IS NULL" : les 17
-- périodes legacy ont date_fin IS NULL. Avec un index sur date_fin IS NULL,
-- ces 17 lignes seraient jugées ouvertes et BLOQUERAIENT toute réinscription
-- future dans le même groupe. En portant la contrainte sur le statut, une
-- période 'inconnu' reste correctement fermée et la réinscription reste
-- possible.
-- =============================================================================
DROP INDEX "inscriptions_eleve_id_groupe_id_key";

CREATE UNIQUE INDEX "inscriptions_eleve_groupe_ouverte_key"
  ON "inscriptions"("eleve_id", "groupe_id") WHERE "statut" = 'actif';

-- CreateIndex : requête d'appartenance historique (eleve, groupe, date)
CREATE INDEX "inscriptions_eleve_id_groupe_id_date_debut_date_fin_idx" ON "inscriptions"("eleve_id", "groupe_id", "date_debut", "date_fin");

-- CreateIndex : historique global d'un élève
CREATE INDEX "inscriptions_eleve_id_date_debut_idx" ON "inscriptions"("eleve_id", "date_debut");
