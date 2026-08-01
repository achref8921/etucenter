import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function requireActiveCenter(method: string = "GET") {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }

  const frozen = (session.user as any).frozen === true;

  if (frozen && method.toUpperCase() !== "GET") {
    return {
      session,
      error: NextResponse.json(
        { error: "Compte gelé : aucune modification autorisée", frozen: true },
        { status: 403 }
      ),
    };
  }

  return { session, frozen, error: null };
}
