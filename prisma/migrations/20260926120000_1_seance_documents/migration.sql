-- CreateTable
CREATE TABLE "seance_documents" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "seance_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "pathname" VARCHAR(450) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seance_documents_seance_id_created_at_idx" ON "seance_documents"("seance_id", "created_at");

-- CreateIndex
CREATE INDEX "seance_documents_center_id_seance_id_idx" ON "seance_documents"("center_id", "seance_id");

-- CreateIndex
CREATE INDEX "seance_documents_center_id_created_at_idx" ON "seance_documents"("center_id", "created_at");

-- CreateIndex
CREATE INDEX "seance_documents_uploaded_by_id_idx" ON "seance_documents"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "seance_documents" ADD CONSTRAINT "seance_documents_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seance_documents" ADD CONSTRAINT "seance_documents_seance_id_fkey" FOREIGN KEY ("seance_id") REFERENCES "seances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seance_documents" ADD CONSTRAINT "seance_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

