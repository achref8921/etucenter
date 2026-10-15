import { NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { getProfReverseSettings } from "@/lib/reverse-finance";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const profId = (session.user as any).id;
    const settings = await getProfReverseSettings(centerId, profId);

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}