-- 15 : messagerie interne 1 à 1 entre les membres d'un même centre.
--
-- Une conversation est identifiée par une paire d'utilisateurs triée
-- (pair_key = "<uuid>:<uuid>"). L'unicité de cette clé garantit qu'il ne peut
-- exister qu'un seul fil pour deux personnes, même si les deux ouvrent la
-- conversation en même temps.
--
-- L'état de lecture est dénormalisé sur chaque participant (unread_count) afin
-- que le badge de la barre latérale et la liste des conversations restent
-- instantanés sans agréger tous les messages à chaque requête.

CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "pair_key" VARCHAR(80) NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversations_pair_key_key" ON "conversations"("pair_key");
CREATE INDEX "conversations_center_id_last_message_at_idx" ON "conversations"("center_id", "last_message_at");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_center_id_fkey"
  FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key"
  ON "conversation_participants"("conversation_id", "user_id");
CREATE INDEX "conversation_participants_user_id_unread_count_idx"
  ON "conversation_participants"("user_id", "unread_count");
CREATE INDEX "conversation_participants_user_id_idx"
  ON "conversation_participants"("user_id");

ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "client_id" VARCHAR(64),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "messages_conversation_id_client_id_key"
  ON "messages"("conversation_id", "client_id");
CREATE INDEX "messages_conversation_id_created_at_idx"
  ON "messages"("conversation_id", "created_at");
CREATE INDEX "messages_conversation_id_sender_id_read_at_idx"
  ON "messages"("conversation_id", "sender_id", "read_at");
CREATE INDEX "messages_sender_id_idx"
  ON "messages"("sender_id");

ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
