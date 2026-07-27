import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function requireActiveCenter() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }

  if ((session.user as any).centerSuspended) {
    return { session, error: NextResponse.json({ error: "Centre suspendu", suspended: true }, { status: 403 }) };
  }

  return { session, error: null };
}
