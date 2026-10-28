import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendPushToUsers } from "@/lib/push";
import {
  MAX_MESSAGE_LENGTH,
  chatActorFromSession,
  getConversationForActor,
  markConversationRead,
  serializeChatUser,
  type ChatActor,
} from "@/lib/chat";

type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  clientId: string | null;
  createdAt: Date;
  readAt: Date | null;
};

function serializeMessage(message: MessageRow) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    clientId: message.clientId,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt ? message.readAt.toISOString() : null,
  };
}

const INCREMENTAL_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchIncrementalThread(
  actor: ChatActor,
  conversationId: string,
  after: Date
) {
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: actor.id,
      conversation: { centerId: actor.centerId },
    },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          participants: {
            where: { userId: { not: actor.id } },
            select: { lastReadAt: true },
          },
        },
      },
    },
  });

  if (!participant) return null;

  const rows = await prisma.message.findMany({
    where: { conversationId, createdAt: { gte: after } },
    orderBy: { createdAt: "asc" },
    take: INCREMENTAL_LIMIT,
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      content: true,
      clientId: true,
      createdAt: true,
      readAt: true,
    },
  });

  // Trop de messages accumulés : le client recharge le fil complet.
  if (rows.length >= INCREMENTAL_LIMIT) {
    return { incremental: true, reset: true, messages: [] };
  }

  const other = participant.conversation.participants[0] ?? null;

  // Le contact n'est pas renvoyé : le client le connaît déjà depuis le
  // chargement initial. Cela évite une jointure supplémentaire à chaque sondage.
  return {
    incremental: true,
    reset: false,
    conversation: {
      id: participant.conversation.id,
      lastMessageAt: participant.conversation.lastMessageAt.toISOString(),
      myLastReadAt: participant.lastReadAt ? participant.lastReadAt.toISOString() : null,
      otherLastReadAt: other?.lastReadAt ? other.lastReadAt.toISOString() : null,
    },
    messages: rows.map(serializeMessage),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("GET");
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) {
      return NextResponse.json({ error: "Messagerie indisponible pour ce compte" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);

    // Rafraîchissement incrémental : ne renvoie que les messages postérieurs à
    // `after` (+ l'état de lecture du correspondant). Beaucoup plus léger que le
    // chargement complet, qui reste utilisé à l'ouverture du fil.
    const afterRaw = searchParams.get("after");
    const afterDate = afterRaw ? new Date(afterRaw) : null;
    const after = afterDate && !Number.isNaN(afterDate.getTime()) ? afterDate : null;

    if (after) {
      const incremental = await fetchIncrementalThread(actor, id, after);
      if (!incremental) {
        return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
      }
      return NextResponse.json(incremental);
    }

    const access = await getConversationForActor(actor, id);
    if (!access) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }

    const requested = Number.parseInt(searchParams.get("take") || "30", 10);
    const take = Number.isFinite(requested) ? Math.min(Math.max(requested, 10), 60) : 30;

    const beforeRaw = searchParams.get("before");
    const beforeDate = beforeRaw ? new Date(beforeRaw) : null;
    const before = beforeDate && !Number.isNaN(beforeDate.getTime()) ? beforeDate : null;

    const rows = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        clientId: true,
        createdAt: true,
        readAt: true,
      },
    });

    const hasMore = rows.length > take;
    const page = rows.slice(0, take).reverse();

    return NextResponse.json({
      conversation: {
        id: access.conversation.id,
        lastMessageAt: access.conversation.lastMessageAt.toISOString(),
        other: serializeChatUser(access.other.user),
        myLastReadAt: access.participant.lastReadAt
          ? access.participant.lastReadAt.toISOString()
          : null,
        otherLastReadAt: access.other.lastReadAt
          ? access.other.lastReadAt.toISOString()
          : null,
      },
      messages: page.map(serializeMessage),
      hasMore,
    });
  } catch (error) {
    logger.error("Erreur lors du chargement des messages", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) {
      return NextResponse.json({ error: "Messagerie indisponible pour ce compte" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }

    const access = await getConversationForActor(actor, id);
    if (!access) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rawContent = typeof body?.content === "string" ? body.content : "";
    const content = rawContent.replace(/\r\n/g, "\n").trim();

    if (!content) {
      return NextResponse.json({ error: "Le message est vide" }, { status: 400 });
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Le message ne doit pas dépasser ${MAX_MESSAGE_LENGTH} caractères` },
        { status: 400 }
      );
    }

    const rawClientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
    const clientId = /^[A-Za-z0-9_-]{8,64}$/.test(rawClientId) ? rawClientId : null;

    if (clientId) {
      const duplicate = await prisma.message.findFirst({
        where: { conversationId: id, clientId },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          content: true,
          clientId: true,
          createdAt: true,
          readAt: true,
        },
      });
      if (duplicate) {
        return NextResponse.json({ message: serializeMessage(duplicate) });
      }
    }

    // Transaction par lot (et non interactive) : sur Neon/pgbouncer, une
    // transaction interactive peut être perdue si la connexion est réassignée.
    const createdAt = new Date();
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: id,
          senderId: actor.id,
          content,
          clientId,
          createdAt,
        },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          content: true,
          clientId: true,
          createdAt: true,
          readAt: true,
        },
      }),

      // Envoyer une réponse implique avoir lu les messages reçus.
      prisma.message.updateMany({
        where: { conversationId: id, senderId: { not: actor.id }, readAt: null },
        data: { readAt: createdAt },
      }),

      prisma.conversationParticipant.update({
        where: { id: access.participant.id },
        data: { unreadCount: 0, lastReadAt: createdAt },
      }),

      // Répondre vaut lecture : les alertes de cette conversation sont soldées.
      prisma.notification.updateMany({
        where: {
          destinataireId: actor.id,
          type: "chat_message",
          lu: false,
          lien: `/messages?c=${id}`,
        },
        data: { lu: true },
      }),

      prisma.conversationParticipant.updateMany({
        where: { conversationId: id, userId: { not: actor.id } },
        data: { unreadCount: { increment: 1 } },
      }),

      prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: createdAt },
      }),
    ]);

    const recipient = await prisma.conversationParticipant.findFirst({
      where: { conversationId: id, userId: { not: actor.id } },
      select: { userId: true, unreadCount: true },
    });

    const result = { message, recipient };

    const preview = content.length > 140 ? `${content.slice(0, 137)}...` : content;
    const sender = await prisma.utilisateur.findUnique({
      where: { id: actor.id },
      select: { prenom: true, nom: true },
    });

    // Une seule alerte par salve de messages non lus : on évite de saturer la
    // cloche et les notifications push quand une conversation est active.
    // Les écritures sont attendues : sur un environnement serverless, une
    // promesse non attendue peut être interrompue avant l'enregistrement.
    if (result.recipient && result.recipient.unreadCount === 1) {
      const senderName = sender ? `${sender.prenom} ${sender.nom}` : "Nouveau message";

      try {
        await prisma.notification.create({
          data: {
            centerId: actor.centerId,
            destinataireId: result.recipient.userId,
            titre: "Nouveau message",
            message: `${senderName} : ${preview}`,
            type: "chat_message",
            lien: `/messages?c=${id}`,
          },
        });
      } catch (notificationError) {
        logger.warn("Notification de message non enregistrée", { error: notificationError });
      }

      await sendPushToUsers([result.recipient.userId], {
        title: senderName,
        body: preview,
        url: `/messages?c=${id}`,
      }).catch(() => {});
    }

    return NextResponse.json({ message: serializeMessage(result.message) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Message déjà envoyé" }, { status: 409 });
    }
    logger.error("Erreur lors de l'envoi d'un message", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
