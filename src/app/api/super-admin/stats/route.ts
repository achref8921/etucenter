import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const [
      totalCenters,
      activeCenters,
      totalUsers,
      totalAdmins,
      totalTeachers,
      totalStudents,
      totalGroups,
    ] = await Promise.all([
      prisma.center.count(),
      prisma.center.count({ where: { active: true } }),
      prisma.utilisateur.count({ where: { role: { not: "super_admin" } } }),
      prisma.utilisateur.count({ where: { role: "admin" } }),
      prisma.utilisateur.count({ where: { role: "prof" } }),
      prisma.utilisateur.count({ where: { role: "eleve" } }),
      prisma.groupe.count(),
    ]);

    return NextResponse.json({
      totalCenters,
      activeCenters,
      inactiveCenters: totalCenters - activeCenters,
      totalUsers,
      totalAdmins,
      totalTeachers,
      totalStudents,
      totalGroups,
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
