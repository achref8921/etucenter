import { NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { chatActorFromSession } from "@/lib/chat";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET");
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) return NextResponse.json({ totalUnread: 0 });

    const aggregate = await prisma.conversationParticipant.aggregate({
      where: {
        userId: actor.id,
        conversation: { centerId: actor.centerId },
      },
      _sum: { unreadCount: true },
    });

    return NextResponse.json({ totalUnread: aggregate._sum.unreadCount ?? 0 });
  } catch {
    return NextResponse.json({ totalUnread: 0 });
  }
}
