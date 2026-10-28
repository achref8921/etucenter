import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { chatActorFromSession, markConversationRead } from "@/lib/chat";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireActiveCenter("POST");
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) {
      return NextResponse.json({ error: "Messagerie indisponible pour ce compte" }, { status: 403 });
    }

    const { id } = await params;
    const readAt = await markConversationRead(actor, id);

    if (!readAt) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, readAt: readAt.toISOString() });
  } catch (error) {
    logger.error("Erreur lors du marquage comme lu", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
