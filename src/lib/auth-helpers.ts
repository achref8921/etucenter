import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const ADMIN_ROLES = ["admin", "super_admin"];
export const PROF_ROLES = ["prof"];
export const ELEVE_ROLES = ["eleve"];

export async function requireActiveCenter(method: string = "GET", roles?: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }

  const sessionRole = (session.user as any).role as string;

  if (roles && roles.length > 0 && !roles.includes(sessionRole)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Non autorisé" }, { status: 403 }),
    };
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

export async function requireProfCanManageEleves(method: string = "GET") {
  const { session, error, frozen } = await requireActiveCenter(method, PROF_ROLES);
  if (error) return { session: null, manage: false, frozen: false, error };

  const userId = (session.user as any).id;

  const prof = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { peutGererEleves: true },
  });

  if (!prof?.peutGererEleves) {
    return {
      session,
      manage: false,
      frozen,
      error: NextResponse.json(
        { error: "Vous n'avez pas la permission de gérer des élèves" },
        { status: 403 }
      ),
    };
  }

  return { session, manage: true, frozen, error: null };
}
