-- =============================================================================
-- Migration 3/9 — ARCHIVAGE DE GROUPE (strictement additive)
-- -----------------------------------------------------------------------------
-- Objectif : permettre d'archiver un groupe (statut 'archive') au lieu de le
-- supprimer physiquement, SANS toucher la moindre donnée existante.
--
-- Sûreté : cette migration ne contient QUE des créations (types, colonnes,
-- index, clé étrangère) et ne modifie AUCUNE ligne. Elle est réversible par
-- simple DROP et n'affecte ni les inscriptions, ni les séances, ni les
-- présences, ni les paiements, ni les transactions financières.
--
-- Rappel : 'actif' est la valeur par défaut, donc tous les codes existants qui
-- lisent les groupes continuent de fonctionner sans aucune modification.
-- =============================================================================

-- CreateEnum
CREATE TYPE "GroupeStatut" AS ENUM ('actif', 'archive');

-- AlterTable
ALTER TABLE "groupes" ADD COLUMN     "statut" "GroupeStatut" NOT NULL DEFAULT 'actif';

-- AlterTable
ALTER TABLE "groupes" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "groupes" ADD COLUMN     "archived_by_id" UUID;

-- AlterTable
ALTER TABLE "groupes" ADD COLUMN     "archive_motif" TEXT;

-- AddForeignKey
ALTER TABLE "groupes" ADD CONSTRAINT "groupes_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "groupes_center_id_statut_idx" ON "groupes"("center_id", "statut");

-- CreateIndex
CREATE INDEX "groupes_statut_archived_at_idx" ON "groupes"("statut", "archived_at");
