-- =============================================================================
-- Migration 6/9 — COHÉRENCE DES BORNES DE PÉRIODE
-- -----------------------------------------------------------------------------
-- ⚠️ À DÉPLOYER APRÈS le code applicatif qui gère les périodes (étape E du plan),
--    et dans une fenêtre distincte des migrations 3/4/5.
--
-- Pourquoi ce retard volontaire : cette contrainte refuse qu'une période ACTIVE
-- porte date_fin_source = 'inconnu'. Or les 16 réactivations de périodes legacy
-- 'inconnu' que fait le code actuel (en réactivant la ligne existante) se
-- retrouveraient en erreur 500 si la contrainte était posée avant son
-- correction. En la reportant, les migrations 3/4/5 restent déployables seules,
-- sans aucune régression de comportement, et la garantie est posée juste après.
--
-- Ce qu'elle garantit :
--   1. une période ACTIVE n'a pas de date de fin connue ;
--   2. une période active ne peut pas être marquée 'inconnu' — ce marqueur ne
--      sert qu'aux périodes legacy dont la sortie n'a JAMAIS été enregistrée.
--
-- Les données existantes respectent déjà ces deux règles à l'instant de la
-- migration 4 (vérifié en production : 0 inscription dont 'statut' sort de
-- {actif, inactif} ; les 170 périodes actives ont date_fin NULL et
-- date_fin_source NULL, les 17 périodes legacy ont date_fin_source 'inconnu'
-- avec statut 'inactif').
--
-- Cette migration ne modifie AUCUNE ligne : la contrainte est validée par
-- PostgreSQL à sa création, ce qui échouerait si une ligne la violait.
-- =============================================================================

ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_periode_coherente" CHECK (
    ("statut" = 'actif'  AND "date_fin" IS NULL
       AND ("date_fin_source" IS NULL OR "date_fin_source" <> 'inconnu'))
 OR ("statut" = 'inactif')
);
