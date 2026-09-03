import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { gatherCenterBackup, serializeBackup } from "@/lib/admin-backup-full";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;
    const centerId = (session.user as any).centerId;

    const centre = await prisma.center.findUnique({
      where: { id: centerId },
      select: { name: true, slug: true },
    });

    const dump = await gatherCenterBackup(prisma, centerId, centre?.name || "Unknown", centre?.slug || "");
    const json = serializeBackup(dump);

    const filename = `backup-${centre?.slug || "centre"}-${new Date().toISOString().slice(0, 10)}.educenter`;

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(Buffer.byteLength(json, "utf8")),
      },
    });
  } catch (error: any) {
    console.error("=== BACKUP EXPORT ERROR ===");
    console.error("Name:", error?.name);
    console.error("Message:", error?.message);
    console.error("Stack:", error?.stack);
    return NextResponse.json(
      { error: "Erreur lors de l'export des données" },
      { status: 500 }
    );
  }
}
