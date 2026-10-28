import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { chatActorFromSession, listChatContacts } from "@/lib/chat";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET");
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) {
      return NextResponse.json({ error: "Messagerie indisponible pour ce compte" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const contacts = await listChatContacts(actor, query);

    return NextResponse.json({ contacts });
  } catch (error) {
    logger.error("Erreur lors du chargement des contacts", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
