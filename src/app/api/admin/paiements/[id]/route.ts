import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdminRole((session.user as any).role as string)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { montant, raison } = body;

    if (!montant || typeof montant !== "number" || montant <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }
    if (!raison || typeof raison !== "string" || raison.trim().length < 3) {
      return NextResponse.json({ error: "La raison est requise (min 3 caractères)" }, { status: 400 });
    }

    const centreId = (session.user as any).centerId;

    const paiement = await prisma.paiement.findUnique({
      where: { id },
      include: {
        eleve: { select: { id: true, nom: true, prenom: true } },
        groupe: { select: { id: true, nom: true, centerId: true } },
      },
    });

    if (!paiement || paiement.groupe.centerId !== centreId) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
    }

    const ancienMontant = Number(paiement.montant);

    const updated = await prisma.paiement.update({
      where: { id },
      data: { montant },
      include: {
        eleve: { select: { id: true, nom: true, prenom: true } },
        groupe: { select: { id: true, nom: true } },
      },
    });

    const diff = montant - ancienMontant;
    const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;

    await prisma.notification.create({
      data: {
        centerId: (session.user as any).centerId,
        destinataireId: paiement.eleveId,
        titre: "Modification de paiement",
        message: `Votre paiement pour le groupe "${paiement.groupe.nom}" a été modifié par l'administration. Montant: ${ancienMontant} DT → ${montant} DT (${diffLabel} DT). Raison: ${raison.trim()}`,
        type: "modification_paiement",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
