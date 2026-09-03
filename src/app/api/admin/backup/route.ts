import { NextResponse } from "next/server";
import { requireActiveCenter, ADMIN_ROLES } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { buildBackupWorkbook, backupWorkbookToBuffer } from "@/lib/admin-backup-excel";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter("GET", ADMIN_ROLES);
    if (error) return error;
    const centerId = (session.user as any).centerId;

    const centre = await prisma.center.findUnique({
      where: { id: centerId },
      select: { name: true, slug: true },
    });

    const [utilisateurs, groupes, matieres, seances, presences, paiements, inscriptions, tauxBenefices, notifications] =
      await Promise.all([
        prisma.utilisateur.findMany({
          where: { centerId },
          select: {
            id: true, nom: true, prenom: true, email: true, telephone: true,
            role: true, actif: true, codeEleve: true, niveau: true,
            classe: true, filiere: true, dateNaissance: true, createdAt: true,
          },
        }),
        prisma.groupe.findMany({
          where: { centerId },
          select: {
            id: true, nom: true, description: true, profId: true,
            matiereId: true, prixParSeance: true, capaciteMax: true, createdAt: true,
          },
        }),
        prisma.matiere.findMany({
          where: { centerId },
          select: { id: true, nom: true, description: true, createdAt: true },
        }),
        prisma.seance.findMany({
          where: { groupe: { centerId } },
          select: {
            id: true, groupeId: true, date: true, heureDebut: true,
            heureFin: true, statut: true, notes: true, createdAt: true,
          },
        }),
        prisma.presence.findMany({
          where: { seance: { groupe: { centerId } } },
          select: {
            id: true, seanceId: true, eleveId: true, statut: true,
            enregistrePar: true, dateCreation: true,
          },
        }),
        prisma.paiement.findMany({
          where: { groupe: { centerId } },
          select: {
            id: true, eleveId: true, groupeId: true, montant: true,
            datePaiement: true, methodePaiement: true, reference: true,
            notes: true, createdAt: true,
          },
        }),
        prisma.inscription.findMany({
          where: { groupe: { centerId } },
          select: {
            id: true, eleveId: true, groupeId: true,
            dateInscription: true, statut: true,
          },
        }),
        prisma.tauxBenefice.findMany({
          where: { prof: { centerId } },
          select: {
            id: true, profId: true, tauxPourcentage: true, createdAt: true,
          },
        }),
        prisma.notification.findMany({
          where: { centerId },
          select: {
            id: true, destinataireId: true, type: true, titre: true,
            message: true, lu: true, createdAt: true,
          },
        }),
      ]);

    const cleanGroupes = groupes.map((g) => ({
      ...g,
      prixParSeance: Number(g.prixParSeance),
    }));
    const cleanPaiements = paiements.map((p) => ({
      ...p,
      montant: Number(p.montant),
    }));
    const cleanTaux = tauxBenefices.map((t) => ({
      ...t,
      tauxPourcentage: Number(t.tauxPourcentage),
    }));

    const filename = `backup-${centre?.slug || "centre"}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    const wb = buildBackupWorkbook({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      centre: centre?.name || "Unknown",
      centreSlug: centre?.slug || "",
      centerId: centerId,
      data: {
        utilisateurs,
        groupes: cleanGroupes,
        matieres,
        seances,
        presences,
        paiements: cleanPaiements,
        inscriptions,
        tauxBenefices: cleanTaux,
        notifications,
      },
      stats: {
        utilisateurs: utilisateurs.length,
        groupes: cleanGroupes.length,
        matieres: matieres.length,
        seances: seances.length,
        presences: presences.length,
        paiements: cleanPaiements.length,
        inscriptions: inscriptions.length,
        tauxBenefices: cleanTaux.length,
        notifications: notifications.length,
      },
    });

    const buffer = backupWorkbookToBuffer(wb);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
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
