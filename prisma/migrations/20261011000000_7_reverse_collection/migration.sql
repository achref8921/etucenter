-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('FORWARD', 'REVERSE');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID');

-- AlterTable
ALTER TABLE "centers" ADD COLUMN     "teacher_reverse_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teacher_reverse_pct" DECIMAL(5,2) NOT NULL DEFAULT 20.00;

-- AlterTable
ALTER TABLE "teacher_transactions" ADD COLUMN     "amount_received" DECIMAL(10,2),
ADD COLUMN     "center_fee" DECIMAL(10,2),
ADD COLUMN     "collection_pct" DECIMAL(5,2),
ADD COLUMN     "direction" VARCHAR(20),
ADD COLUMN     "linked_debt_id" UUID,
ADD COLUMN     "mode" "Mode" NOT NULL DEFAULT 'FORWARD',
ADD COLUMN     "net_amount" DECIMAL(10,2),
ADD COLUMN     "seance_id" UUID,
ADD COLUMN     "student_id" UUID;

-- CreateTable
CREATE TABLE "teacher_center_debts" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "student_id" UUID,
    "seance_id" UUID,
    "amount_due" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'OPEN',
    "reverse_tx_id" UUID,
    "settlement_tx_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "teacher_center_debts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_center_debts_center_id_status_idx" ON "teacher_center_debts"("center_id", "status");

-- CreateIndex
CREATE INDEX "teacher_center_debts_teacher_id_status_idx" ON "teacher_center_debts"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "teacher_center_debts_teacher_id_status_settled_at_idx" ON "teacher_center_debts"("teacher_id", "status", "settled_at");

-- CreateIndex
CREATE INDEX "teacher_transactions_mode_status_idx" ON "teacher_transactions"("mode", "status");

-- CreateIndex
CREATE INDEX "teacher_transactions_seance_id_idx" ON "teacher_transactions"("seance_id");

-- AddForeignKey
ALTER TABLE "teacher_transactions" ADD CONSTRAINT "teacher_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_transactions" ADD CONSTRAINT "teacher_transactions_seance_id_fkey" FOREIGN KEY ("seance_id") REFERENCES "seances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_transactions" ADD CONSTRAINT "teacher_transactions_linked_debt_id_fkey" FOREIGN KEY ("linked_debt_id") REFERENCES "teacher_center_debts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_center_debts" ADD CONSTRAINT "teacher_center_debts_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_center_debts" ADD CONSTRAINT "teacher_center_debts_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_center_debts" ADD CONSTRAINT "teacher_center_debts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_center_debts" ADD CONSTRAINT "teacher_center_debts_seance_id_fkey" FOREIGN KEY ("seance_id") REFERENCES "seances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
