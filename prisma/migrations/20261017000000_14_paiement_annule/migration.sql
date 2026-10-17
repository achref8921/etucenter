-- 14 : registre des paiements annulés.
--
-- L'annulation d'un paiement (erreur de saisie, mauvais élève, mauvais groupe)
-- efface définitivement la ligne du paiement ainsi que TOUTES les écritures
-- comptables qui en découlent : crédit prépayé de l'élève, part du professeur,
-- dette centre. Les agrégats financiers existants restent donc exacts sans
-- aucun filtre supplémentaire : le paiement disparaît de tous les totaux.
--
-- Ce registre conserve quant à lui l'empreinte de l'annulation : élève, groupe,
-- montant, encaisseur, motif déclaré, auteur et date.

-- CreateTable
CREATE TABLE "paiements_annules" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "paiement_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "eleve_nom" VARCHAR(255) NOT NULL,
    "groupe_id" UUID NOT NULL,
    "groupe_nom" VARCHAR(255) NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "methode_paiement" "MethodePaiement" NOT NULL,
    "date_paiement" TIMESTAMP(3) NOT NULL,
    "collecte_par_prof" BOOLEAN NOT NULL DEFAULT false,
    "collecteur_id" UUID,
    "collecteur_nom" VARCHAR(255),
    "motif" TEXT NOT NULL,
    "annule_par_id" UUID,
    "annule_par_nom" VARCHAR(255),
    "annule_par_role" VARCHAR(20),
    "annule_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_annules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paiements_annules_center_id_annule_le_idx" ON "paiements_annules"("center_id", "annule_le");

-- CreateIndex
CREATE INDEX "paiements_annules_eleve_id_idx" ON "paiements_annules"("eleve_id");

-- CreateIndex
CREATE INDEX "paiements_annules_groupe_id_idx" ON "paiements_annules"("groupe_id");

-- AddForeignKey
ALTER TABLE "paiements_annules" ADD CONSTRAINT "paiements_annules_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
