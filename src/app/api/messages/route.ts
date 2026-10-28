import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  CHAT_USER_SELECT,
  chatActorFromSession,
  pairKeyFor,
  resolveChatTarget,
  serializeChatUser,
} from "@/lib/chat";

type LastMessageRow = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: Date;
  senderId: string;
  readAt: Date | null;
};

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET");
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) {
      return NextResponse.json({ error: "Messagerie indisponible pour ce compte" }, { status: 403 });
    }

    // Trois requêtes plates au lieu d'une lecture imbriquée (5 allers-retours) :
    // sur une base distante, c'est ce qui pèse le plus sur l'ouverture de la page.
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId: actor.id,
        conversation: { centerId: actor.centerId },
      },
      select: {
        conversationId: true,
        unreadCount: true,
        lastReadAt: true,
        conversation: { select: { id: true, lastMessageAt: true } },
      },
    });

    if (participations.length === 0) {
      return NextResponse.json({ conversations: [], totalUnread: 0 });
    }

    const conversationIds = participations.map((item) => item.conversationId);

    const [others, lastMessages] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where: { conversationId: { in: conversationIds }, userId: { not: actor.id } },
        select: {
          conversationId: true,
          user: { select: CHAT_USER_SELECT },
        },
      }),
      prisma.$queryRaw<LastMessageRow[]>`
        SELECT DISTINCT ON (m."conversation_id")
          m."id",
          m."conversation_id" AS "conversationId",
          m."content",
          m."created_at" AS "createdAt",
          m."sender_id" AS "senderId",
          m."read_at" AS "readAt"
        FROM "messages" m
        WHERE m."conversation_id" = ANY(${conversationIds}::uuid[])
        ORDER BY m."conversation_id", m."created_at" DESC
      `,
    ]);

    const otherByConversation = new Map(others.map((item) => [item.conversationId, item.user]));
    const lastByConversation = new Map(lastMessages.map((item) => [item.conversationId, item]));

    const conversations = participations
      .filter((participation) => otherByConversation.has(participation.conversationId))
      .map((participation) => {
        const other = otherByConversation.get(participation.conversationId)!;
        const last = lastByConversation.get(participation.conversationId) ?? null;
        return {
          id: participation.conversation.id,
          other: serializeChatUser(other),
          lastMessage: last
            ? {
                id: last.id,
                content: last.content,
                createdAt: last.createdAt.toISOString(),
                senderId: last.senderId,
                readAt: last.readAt ? last.readAt.toISOString() : null,
              }
            : null,
          unreadCount: participation.unreadCount,
          lastMessageAt: participation.conversation.lastMessageAt.toISOString(),
          lastReadAt: participation.lastReadAt ? participation.lastReadAt.toISOString() : null,
        };
      })
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

    const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

    return NextResponse.json({ conversations, totalUnread });
  } catch (error) {
    logger.error("Erreur lors du chargement des conversations", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) {
      return NextResponse.json({ error: "Messagerie indisponible pour ce compte" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      return NextResponse.json({ error: "Destinataire invalide" }, { status: 400 });
    }

    const target = await resolveChatTarget(actor, targetId);
    if (!target) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à contacter cet utilisateur" },
        { status: 403 }
      );
    }

    const pairKey = pairKeyFor(actor.id, target.id);

    let conversationId: string;
    try {
      const conversation = await prisma.conversation.upsert({
        where: { pairKey },
        create: {
          center: { connect: { id: actor.centerId } },
          pairKey,
          participants: {
            create: [
              { user: { connect: { id: actor.id } } },
              { user: { connect: { id: target.id } } },
            ],
          },
        },
        update: {},
        select: { id: true },
      });
      conversationId = conversation.id;
    } catch (createError) {
      if ((createError as { code?: string })?.code !== "P2002") throw createError;
      const existing = await prisma.conversation.findUnique({
        where: { pairKey },
        select: { id: true },
      });
      if (!existing) throw createError;
      conversationId = existing.id;
    }

    const participation = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: actor.id },
      select: { unreadCount: true, lastReadAt: true },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, lastMessageAt: true },
    });

    return NextResponse.json({
      conversation: {
        id: conversationId,
        other: target,
        unreadCount: participation?.unreadCount ?? 0,
        lastReadAt: participation?.lastReadAt ? participation.lastReadAt.toISOString() : null,
        lastMessageAt: conversation?.lastMessageAt.toISOString() ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Erreur lors de la création d'une conversation", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
