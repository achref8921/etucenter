-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'prof', 'eleve');

-- CreateEnum
CREATE TYPE "PresenceStatut" AS ENUM ('present', 'absent');

-- CreateEnum
CREATE TYPE "SeanceStatut" AS ENUM ('planifiee', 'en_cours', 'terminee', 'annulee');

-- CreateEnum
CREATE TYPE "InscriptionStatut" AS ENUM ('actif', 'inactif');

-- CreateEnum
CREATE TYPE "MethodePaiement" AS ENUM ('especes', 'virement', 'cheque', 'autre');

-- CreateEnum
CREATE TYPE "TeacherTransactionType" AS ENUM ('EARNING', 'PAYMENT', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "TeacherTransactionStatus" AS ENUM ('active', 'reversed');

-- CreateEnum
CREATE TYPE "StudentTransactionType" AS ENUM ('PREPAYMENT', 'COURSE_CONSUMPTION', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "StudentTransactionStatus" AS ENUM ('active', 'reversed');

-- CreateEnum
CREATE TYPE "NiveauScolaire" AS ENUM ('primaire', 'college', 'lycee');

-- CreateEnum
CREATE TYPE "Filiere" AS ENUM ('lettres', 'economique', 'informatique', 'technique', 'sciences', 'math');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('en_cours', 'ok', 'echec', 'restaure');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('automatique', 'manuel');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "MonitorCheckType" AS ENUM ('server', 'database', 'resources');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('ok', 'warning', 'error');

-- CreateEnum
CREATE TYPE "AnalyticsEventName" AS ENUM ('SESSION_STARTED', 'SESSION_ENDED', 'PAGE_VIEW', 'STUDENT_VIEWED', 'STUDENT_CREATED', 'STUDENT_UPDATED', 'GROUP_VIEWED', 'GROUP_CREATED', 'GROUP_UPDATED', 'ATTENDANCE_VIEWED', 'ATTENDANCE_MARKED', 'PAYMENT_VIEWED', 'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_DELETED', 'REPORT_EXPORTED', 'NOTIFICATION_VIEWED', 'ASSISTANT_USED');

-- CreateTable
CREATE TABLE "centers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "logo" TEXT,
    "phone" VARCHAR(20),
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "prenom" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "mot_de_passe" VARCHAR(255),
    "telephone" VARCHAR(20),
    "role" "Role" NOT NULL,
    "image" TEXT,
    "date_naissance" DATE,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "peut_gerer_eleves" BOOLEAN NOT NULL DEFAULT false,
    "code_eleve" VARCHAR(4),
    "code_prof" VARCHAR(5),
    "niveau" "NiveauScolaire",
    "classe" VARCHAR(50),
    "filiere" "Filiere",
    "deleted_at" TIMESTAMP(3),
    "ghost" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "provider" VARCHAR(50) DEFAULT 'credentials',
    "provider_id" VARCHAR(255),
    "email_verified" TIMESTAMP(3),
    "email_verification_token" VARCHAR(255),
    "email_verification_expiry" TIMESTAMP(3),
    "password_reset_token" VARCHAR(255),
    "password_reset_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matieres" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groupes" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "prof_id" UUID,
    "matiere_id" UUID,
    "prix_par_seance" DECIMAL(10,2) NOT NULL,
    "forfait_montant" DECIMAL(10,2),
    "forfait_seances" INTEGER,
    "capacite_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groupes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions" (
    "id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "groupe_id" UUID NOT NULL,
    "date_inscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "InscriptionStatut" NOT NULL DEFAULT 'actif',
    "forfait_montant" DECIMAL(10,2),
    "forfait_seances" INTEGER,
    "forfait_set_at" TIMESTAMP(3),

    CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seances" (
    "id" UUID NOT NULL,
    "groupe_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "heure_debut" TIME,
    "heure_fin" TIME,
    "statut" "SeanceStatut" NOT NULL DEFAULT 'planifiee',
    "notes" TEXT,
    "prix_par_seance" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presences" (
    "id" UUID NOT NULL,
    "seance_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "statut" "PresenceStatut" NOT NULL,
    "enregistre_par" UUID,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "groupe_id" UUID NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "date_paiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "methode_paiement" "MethodePaiement" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taux_benefices" (
    "id" UUID NOT NULL,
    "prof_id" UUID NOT NULL,
    "taux_pourcentage" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taux_benefices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_transactions" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "type" "TeacherTransactionType" NOT NULL,
    "status" "TeacherTransactionStatus" NOT NULL DEFAULT 'active',
    "amount" DECIMAL(10,2) NOT NULL,
    "signed_amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "payment_method" "MethodePaiement",
    "date" DATE NOT NULL,
    "time" TIME,
    "receipt_number" VARCHAR(50),
    "reference" VARCHAR(100),
    "notes" TEXT,
    "created_by" UUID,
    "reversal_of_id" UUID,
    "reversed_by_id" UUID,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_transactions" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "eleve_id" UUID NOT NULL,
    "type" "StudentTransactionType" NOT NULL,
    "status" "StudentTransactionStatus" NOT NULL DEFAULT 'active',
    "amount" DECIMAL(10,2) NOT NULL,
    "signed_amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "payment_method" "MethodePaiement",
    "date" DATE NOT NULL,
    "time" TIME,
    "receipt_number" VARCHAR(50),
    "reference" VARCHAR(100),
    "attendance_id" UUID,
    "idempotency_key" VARCHAR(64),
    "notes" TEXT,
    "created_by" UUID,
    "reversal_of_id" UUID,
    "reversed_by_id" UUID,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "destinataire_id" UUID NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(255) NOT NULL,
    "auth" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(50),
    "entity_id" UUID,
    "details" JSONB,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_backups" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "BackupType" NOT NULL DEFAULT 'manuel',
    "status" "BackupStatus" NOT NULL DEFAULT 'en_cours',
    "checksum" VARCHAR(64),
    "sizeBytes" INTEGER,
    "rowCounts" JSONB,
    "data" TEXT,
    "error" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "restored_at" TIMESTAMP(3),

    CONSTRAINT "system_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "center_subscriptions" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "statut" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "center_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "monitor_checks" (
    "id" UUID NOT NULL,
    "type" "MonitorCheckType" NOT NULL,
    "status" "MonitorStatus" NOT NULL,
    "response_time_ms" INTEGER,
    "details" JSONB,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "session_id" UUID,
    "event" "AnalyticsEventName" NOT NULL,
    "path" VARCHAR(255),
    "feature" VARCHAR(80),
    "metadata" JSONB,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "end_reason" VARCHAR(40),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "centers_slug_key" ON "centers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "centers_code_key" ON "centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE INDEX "utilisateurs_center_id_role_idx" ON "utilisateurs"("center_id", "role");

-- CreateIndex
CREATE INDEX "utilisateurs_last_seen_at_idx" ON "utilisateurs"("last_seen_at");

-- CreateIndex
CREATE INDEX "utilisateurs_center_id_email_idx" ON "utilisateurs"("center_id", "email");

-- CreateIndex
CREATE INDEX "utilisateurs_center_id_role_created_at_idx" ON "utilisateurs"("center_id", "role", "created_at");

-- CreateIndex
CREATE INDEX "utilisateurs_role_idx" ON "utilisateurs"("role");

-- CreateIndex
CREATE INDEX "utilisateurs_code_eleve_idx" ON "utilisateurs"("code_eleve");

-- CreateIndex
CREATE INDEX "utilisateurs_code_prof_idx" ON "utilisateurs"("code_prof");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_center_id_code_eleve_key" ON "utilisateurs"("center_id", "code_eleve");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_center_id_code_prof_key" ON "utilisateurs"("center_id", "code_prof");

-- CreateIndex
CREATE INDEX "matieres_center_id_idx" ON "matieres"("center_id");

-- CreateIndex
CREATE UNIQUE INDEX "matieres_center_id_nom_key" ON "matieres"("center_id", "nom");

-- CreateIndex
CREATE INDEX "groupes_center_id_prof_id_idx" ON "groupes"("center_id", "prof_id");

-- CreateIndex
CREATE INDEX "groupes_center_id_idx" ON "groupes"("center_id");

-- CreateIndex
CREATE INDEX "groupes_matiere_id_idx" ON "groupes"("matiere_id");

-- CreateIndex
CREATE INDEX "inscriptions_groupe_id_idx" ON "inscriptions"("groupe_id");

-- CreateIndex
CREATE INDEX "inscriptions_groupe_id_statut_idx" ON "inscriptions"("groupe_id", "statut");

-- CreateIndex
CREATE INDEX "inscriptions_eleve_id_statut_idx" ON "inscriptions"("eleve_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_eleve_id_groupe_id_key" ON "inscriptions"("eleve_id", "groupe_id");

-- CreateIndex
CREATE INDEX "seances_groupe_id_date_idx" ON "seances"("groupe_id", "date");

-- CreateIndex
CREATE INDEX "seances_date_idx" ON "seances"("date");

-- CreateIndex
CREATE INDEX "presences_eleve_id_idx" ON "presences"("eleve_id");

-- CreateIndex
CREATE INDEX "presences_eleve_id_statut_idx" ON "presences"("eleve_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "presences_seance_id_eleve_id_key" ON "presences"("seance_id", "eleve_id");

-- CreateIndex
CREATE INDEX "paiements_eleve_id_groupe_id_idx" ON "paiements"("eleve_id", "groupe_id");

-- CreateIndex
CREATE INDEX "paiements_eleve_id_idx" ON "paiements"("eleve_id");

-- CreateIndex
CREATE INDEX "paiements_groupe_id_date_paiement_idx" ON "paiements"("groupe_id", "date_paiement");

-- CreateIndex
CREATE INDEX "paiements_date_paiement_idx" ON "paiements"("date_paiement");

-- CreateIndex
CREATE UNIQUE INDEX "taux_benefices_prof_id_key" ON "taux_benefices"("prof_id");

-- CreateIndex
CREATE INDEX "teacher_transactions_center_id_teacher_id_date_idx" ON "teacher_transactions"("center_id", "teacher_id", "date");

-- CreateIndex
CREATE INDEX "teacher_transactions_teacher_id_date_idx" ON "teacher_transactions"("teacher_id", "date");

-- CreateIndex
CREATE INDEX "teacher_transactions_type_status_idx" ON "teacher_transactions"("type", "status");

-- CreateIndex
CREATE INDEX "teacher_transactions_center_id_type_idx" ON "teacher_transactions"("center_id", "type");

-- CreateIndex
CREATE INDEX "student_transactions_center_id_eleve_id_date_idx" ON "student_transactions"("center_id", "eleve_id", "date");

-- CreateIndex
CREATE INDEX "student_transactions_eleve_id_date_idx" ON "student_transactions"("eleve_id", "date");

-- CreateIndex
CREATE INDEX "student_transactions_type_status_idx" ON "student_transactions"("type", "status");

-- CreateIndex
CREATE INDEX "student_transactions_center_id_type_idx" ON "student_transactions"("center_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "student_transactions_eleve_id_attendance_id_key" ON "student_transactions"("eleve_id", "attendance_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_transactions_idempotency_key_key" ON "student_transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "student_transactions_reversal_of_id_key" ON "student_transactions"("reversal_of_id");

-- CreateIndex
CREATE INDEX "notifications_center_id_destinataire_id_idx" ON "notifications"("center_id", "destinataire_id");

-- CreateIndex
CREATE INDEX "notifications_destinataire_id_lu_idx" ON "notifications"("destinataire_id", "lu");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

-- CreateIndex
CREATE INDEX "system_logs_action_created_at_idx" ON "system_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_logs_user_id_idx" ON "system_logs"("user_id");

-- CreateIndex
CREATE INDEX "system_backups_created_at_idx" ON "system_backups"("created_at");

-- CreateIndex
CREATE INDEX "system_backups_status_idx" ON "system_backups"("status");

-- CreateIndex
CREATE INDEX "center_subscriptions_center_id_idx" ON "center_subscriptions"("center_id");

-- CreateIndex
CREATE INDEX "center_subscriptions_statut_idx" ON "center_subscriptions"("statut");

-- CreateIndex
CREATE INDEX "center_subscriptions_date_fin_idx" ON "center_subscriptions"("date_fin");

-- CreateIndex
CREATE INDEX "monitor_checks_type_checked_at_idx" ON "monitor_checks"("type", "checked_at");

-- CreateIndex
CREATE INDEX "monitor_checks_status_checked_at_idx" ON "monitor_checks"("status", "checked_at");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_idx" ON "analytics_events"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_center_id_idx" ON "analytics_events"("center_id");

-- CreateIndex
CREATE INDEX "analytics_events_event_idx" ON "analytics_events"("event");

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "analytics_events_center_id_created_at_idx" ON "analytics_events"("center_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_event_created_at_idx" ON "analytics_events"("event", "created_at");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_center_id_idx" ON "user_sessions"("center_id");

-- CreateIndex
CREATE INDEX "user_sessions_started_at_idx" ON "user_sessions"("started_at");

-- CreateIndex
CREATE INDEX "user_sessions_ended_at_idx" ON "user_sessions"("ended_at");

-- CreateIndex
CREATE INDEX "user_sessions_center_id_started_at_idx" ON "user_sessions"("center_id", "started_at");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matieres" ADD CONSTRAINT "matieres_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupes" ADD CONSTRAINT "groupes_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupes" ADD CONSTRAINT "groupes_prof_id_fkey" FOREIGN KEY ("prof_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupes" ADD CONSTRAINT "groupes_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seances" ADD CONSTRAINT "seances_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_seance_id_fkey" FOREIGN KEY ("seance_id") REFERENCES "seances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presences" ADD CONSTRAINT "presences_enregistre_par_fkey" FOREIGN KEY ("enregistre_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taux_benefices" ADD CONSTRAINT "taux_benefices_prof_id_fkey" FOREIGN KEY ("prof_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_transactions" ADD CONSTRAINT "teacher_transactions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_transactions" ADD CONSTRAINT "teacher_transactions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_transactions" ADD CONSTRAINT "teacher_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "teacher_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transactions" ADD CONSTRAINT "student_transactions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transactions" ADD CONSTRAINT "student_transactions_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transactions" ADD CONSTRAINT "student_transactions_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "presences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transactions" ADD CONSTRAINT "student_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "student_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_destinataire_id_fkey" FOREIGN KEY ("destinataire_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "center_subscriptions" ADD CONSTRAINT "center_subscriptions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

