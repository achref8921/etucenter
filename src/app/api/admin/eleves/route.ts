import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { calculateTotalDue, calculateTotalPaid, calculateUnpaid } from "@/lib/calculations";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;

    const eleves = await prisma.utilisateur.findMany({
      where: { role: "eleve", centerId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        codeEleve: true,
        niveau: true,
        classe: true,
        filiere: true,
        inscriptions: {
          where: { statut: "actif" },
          select: {
            groupeId: true,
            groupe: {
              select: {
                id: true,
                nom: true,
                prixParSeance: true,
              },
            },
          },
        },
      },
      orderBy: { nom: "asc" },
    });

    const result = await Promise.all(
      eleves.map(async (e) => {
        const groupes = await Promise.all(
          e.inscriptions.map(async (ins) => {
            const totalDue = await calculateTotalDue(e.id, ins.groupeId);
            const totalPaid = await calculateTotalPaid(e.id, ins.groupeId);
            return {
              groupe: { id: ins.groupe.id, nom: ins.groupe.nom, prixParSeance: Number(ins.groupe.prixParSeance) },
              totalDue,
              totalPaid,
              unpaid: totalDue - totalPaid,
            };
          })
        );
        return { id: e.id, nom: e.nom, prenom: e.prenom, codeEleve: e.codeEleve, niveau: e.niveau, classe: e.classe, filiere: e.filiere, groupes };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
