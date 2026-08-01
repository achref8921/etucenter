import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const backup = await prisma.systemBackup.findUnique({ where: { id } });

    if (!backup || !backup.data) {
      return NextResponse.json({ error: "Sauvegarde introuvable ou incomplète" }, { status: 404 });
    }

    const date = backup.createdAt.toISOString().slice(0, 10);
    const filename = `educenter-backup-v${backup.version}-${date}.json`;

    return new NextResponse(backup.data, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("Erreur lors du téléchargement de la sauvegarde", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
