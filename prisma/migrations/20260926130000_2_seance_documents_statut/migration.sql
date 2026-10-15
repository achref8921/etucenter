-- Cycle de vie du dépôt d'un support : la ligne est créée avant l'upload
-- navigateur ("en_attente") puis confirmée par le callback serveur
-- onUploadCompleted après contrôle réel du blob ("pret").
-- ADDITIF : ALTER TABLE sur seance_documents, table créée par la migration
-- précédente et absente des bases existantes avant ce déploiement.
-- Aucun tabela existante n'est modifiée.

-- AlterTable
ALTER TABLE "seance_documents" ADD COLUMN     "statut" VARCHAR(20) NOT NULL DEFAULT 'en_attente',
ADD COLUMN     "verified_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "seance_documents_center_id_statut_created_at_idx" ON "seance_documents"("center_id", "statut", "created_at");

