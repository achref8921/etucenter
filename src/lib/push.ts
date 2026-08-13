import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

export const PUSH_ENABLED = Boolean(PUBLIC_KEY && PRIVATE_KEY);

if (PUSH_ENABLED) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@etucenter.app",
    PUBLIC_KEY!,
    PRIVATE_KEY!
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!PUSH_ENABLED || userIds.length === 0) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { urgency: "high", TTL: 86400 }
      );
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription
          .delete({ where: { id: sub.id } })
          .catch(() => {});
      } else {
        logger.warn("Échec envoi push", {
          statusCode,
          message: (err as { message?: string })?.message,
        });
      }
    }
  }
  return sent;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  return sendPushToUsers([userId], payload);
}
