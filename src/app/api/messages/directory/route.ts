import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { chatActorFromSession } from "@/lib/chat";
import { getChatDirectory } from "@/lib/chat-directory";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET");
    if (error) return error;

    const actor = chatActorFromSession(session);
    if (!actor) {
      return NextResponse.json({ error: "Messagerie indisponible pour ce compte" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "");

    const directory = await getChatDirectory(actor, {
      q: searchParams.get("q") ?? "",
      groupId: searchParams.get("groupId"),
      ungrouped: searchParams.get("ungrouped") === "1",
      offset: Number(searchParams.get("offset") ?? 0),
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });

    return NextResponse.json(directory);
  } catch (error) {
    logger.error("Erreur lors du chargement de l'annuaire", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
