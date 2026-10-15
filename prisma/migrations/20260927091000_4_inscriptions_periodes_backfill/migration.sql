-- =============================================================================
-- Migration 4/9 — PÉRIODES D'INSCRIPTION : COLONNES + BACKFILL
-- -----------------------------------------------------------------------------
-- Objectif : transformer l'inscription (simple drapeau actif/inactif) en une
-- PÉRIODE datée [date_debut, date_fin] par groupe, en documentant la provenance
-- de chaque borne.
--
-- RÈGLE ABSOLUE : cette migration n'écrit QUE dans les colonnes qu'elle vient de
-- créer. Aucune colonne préexistante n'est modifiée :
--   - "date_inscription"  : JAMAIS modifiée (trace de saisie d'origine)
--   - "statut"             : JAMAIS modifié
--   - "forfait_montant" / "forfait_seances" / "forfait_set_at" : JAMAIS modifiés
--   - tables "seances", "presences", "paiements", "student_transactions",
--     "teacher_transactions", "seance_documents" : LECTURE SEULE, aucun UPDATE
--     ne les touche.
--
-- Les colonnes sont volontairement NULLables ici. Le NOT NULL et les index
-- arrivent en migration 5, après remplissage : c'est ce qui rend le backfill
-- réversible (un DROP de colonne restaure l'état antérieur, sans perte).
-- =============================================================================

-- CreateEnum
CREATE TYPE "InscriptionDateDebutSource" AS ENUM ('inscription', 'presence', 'saisie');

-- CreateEnum
CREATE TYPE "InscriptionDateFinSource" AS ENUM ('saisie', 'deduit', 'inconnu');

-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN     "date_debut" DATE;

-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN     "date_debut_source" "InscriptionDateDebutSource";

-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN     "date_fin" DATE;

-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN     "date_fin_source" "InscriptionDateFinSource";

-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- =============================================================================
-- BACKFILL — étape 1 : date_debut = date_inscription (valeur de repli)
-- La comparaison se fait en DATE (et non en timestamp) car "date_inscription"
-- porte une composante horaire (mesuré : 187/187 lignes). Comparer une date de
-- séance à un timestamp rendrait la frontière du jour ambiguë.
-- =============================================================================
UPDATE "inscriptions" SET "date_debut" = "date_inscription"::date;

UPDATE "inscriptions" SET "date_debut_source" = 'inscription';

-- =============================================================================
-- BACKFILL — étape 2 : rétrogradation par PREUVE de présence
-- date_debut = MIN(date_inscription, 1re date de séance où l'élève a une
-- présence dans le groupe).
--
-- Justification : 75 inscriptions en production ont une présence ANTÉRIEURE à
-- leur date d'inscription (jusqu'à 19 jours d'écart). Sans cette correction,
-- ces élèves verraient leur accès à ces séances refusé à tort.
--
-- Le filtre "s.statut <> 'annulee'" est conservé par précaution : en
-- production il ne retire aucune ligne (aucune séance annulée au moment de
-- l'audit), mais il protège si des séances annulées apparaissent plus tard.
-- La présence prouvée est un MINIMUM : la présence suffit à prouver
-- l'appartenance, que l'élève était 'present' ou 'absent' ce jour-là.
-- =============================================================================
UPDATE "inscriptions" i
SET "date_debut" = p.premiere,
    "date_debut_source" = 'presence'
FROM (
  SELECT i2.id AS id, min(s.date) AS premiere
  FROM "inscriptions" i2
  JOIN "presences" pr ON pr."eleve_id" = i2."eleve_id"
  JOIN "seances" s
    ON s."id" = pr."seance_id"
   AND s."groupe_id" = i2."groupe_id"
  WHERE s."statut" <> 'annulee'
    AND s."date" < i2."date_inscription"::date
  GROUP BY i2.id
) p
WHERE i."id" = p.id;

-- =============================================================================
-- BACKFILL — étape 3 : bornes hautes
--   - 17 inscriptions 'inactif' (legacy) : la date de sortie n'a JAMAIS été
--     enregistrée. On l'inscrit 'inconnu' avec date_fin NULL. date_fin NULL ne
--     signifie PAS "membre jusqu'à aujourd'hui" : cela signifie "fermeture à
--     une date inconnue". Le service membership refuse par défaut sur ces
--     périodes et n'accorde un accès que sur preuve de présence.
--   - 170 inscriptions 'actif' : période ouverte, pas de borne haute.
-- =============================================================================
UPDATE "inscriptions" SET "date_fin" = NULL, "date_fin_source" = 'inconnu' WHERE "statut" = 'inactif';

UPDATE "inscriptions" SET "date_fin" = NULL, "date_fin_source" = NULL      WHERE "statut" = 'actif';

-- =============================================================================
-- BACKFILL — étape 4 : horodatage technique
-- Aligné sur la date de saisie d'origine, pas sur NOW(), pour que l'artefact
-- de la migration soit visible dans l'historique et non masqué par la date du
-- jour de déploiement.
-- =============================================================================
UPDATE "inscriptions" SET "updated_at" = "date_inscription";
