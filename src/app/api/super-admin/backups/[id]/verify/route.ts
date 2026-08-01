import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifySystemBackup } from "@/lib/backup-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const result = await verifySystemBackup(id);

    if (!result.valid) {
      await prisma.systemLog.create({
        data: {
          action: "backup_verify_failed",
          entity: "SystemBackup",
          entityId: id,
          details: { checksumOk: result.checksumOk, structuralErrors: result.structuralErrors },
          userId: (session.user as any).id,
        },
      });
      return NextResponse.json(result, { status: 200 });
    }

    await prisma.systemLog.create({
      data: {
        action: "backup_verified",
        entity: "SystemBackup",
        entityId: id,
        details: { checksumOk: true, counts: result.counts, sizeBytes: result.sizeBytes },
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Erreur lors de la vérification de la sauvegarde", { error });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
