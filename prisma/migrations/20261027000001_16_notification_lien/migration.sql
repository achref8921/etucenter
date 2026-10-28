-- 16 : lien de destination d'une notification.
-- Les notifications de messagerie doivent ouvrir directement la conversation
-- concernée (/messages?c=<id>). Le champ est nullable : les notifications
-- existantes et les autres types ne sont pas affectés.

ALTER TABLE "notifications" ADD COLUMN "lien" VARCHAR(255);
