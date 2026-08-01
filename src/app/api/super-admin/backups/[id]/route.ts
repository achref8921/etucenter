import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { deleteSystemBackup } from "@/lib/backup-service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteSystemBackup(id, (session.user as any).id);

    if (!deleted) {
      return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Sauvegarde supprimée" });
  } catch (error) {
    logger.error("Erreur lors de la suppression de la sauvegarde", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
