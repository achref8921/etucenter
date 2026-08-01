import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifySystemBackup, BACKUP_KIND } from "@/lib/backup-service";

function findBackupUser(dump: any, email: string) {
  const rows = Array.isArray(dump?.tables?.utilisateurs) ? dump.tables.utilisateurs : [];
  return rows.find((u: any) => u.email === email) || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.utilisateur.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const backups = await prisma.systemBackup.findMany({
      where: { status: "ok" },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true, version: true, type: true, status: true,
        sizeBytes: true, checksum: true, createdAt: true, completedAt: true, restoredAt: true,
      },
    });

    const candidates: any[] = [];
    for (const b of backups) {
      const verify = await verifySystemBackup(b.id);
      if (!verify.valid) continue;
      const row = await prisma.systemBackup.findUnique({ where: { id: b.id }, select: { data: true } });
      if (!row?.data) continue;
      let dump: any = null;
      try { dump = JSON.parse(row.data); } catch { continue; }
      if (dump?.kind !== BACKUP_KIND) continue;

      const bu = findBackupUser(dump, user.email);
      if (!bu) continue;

      const counts = {
        inscriptions: Array.isArray(dump.tables?.inscriptions) ? dump.tables.inscriptions.filter((i: any) => i.eleveId === bu.id).length : 0,
        paiements: Array.isArray(dump.tables?.paiements) ? dump.tables.paiements.filter((p: any) => p.eleveId === bu.id).length : 0,
        presences: Array.isArray(dump.tables?.presences) ? dump.tables.presences.filter((p: any) => p.eleveId === bu.id).length : 0,
        tauxBenefice: Array.isArray(dump.tables?.tauxBenefices) ? dump.tables.tauxBenefices.filter((t: any) => t.profId === bu.id).length : 0,
        notifications: Array.isArray(dump.tables?.notifications) ? dump.tables.notifications.filter((n: any) => n.destinataireId === bu.id).length : 0,
      };

      candidates.push({
        id: b.id,
        version: b.version,
        type: b.type,
        createdAt: b.createdAt,
        sizeBytes: b.sizeBytes,
        restoredAt: b.restoredAt,
        hasPassword: !!bu.motDePasse,
        actif: !!bu.actif,
        counts,
      });
    }

    return NextResponse.json({ user: { id: user.id, email: user.email }, backups: candidates });
  } catch (error) {
    logger.error("Erreur lors du listage des versions du compte", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const backupId: string | undefined = body.backupId;

    const user = await prisma.utilisateur.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    let backupRow = backupId
      ? await prisma.systemBackup.findUnique({ where: { id: backupId } })
      : await prisma.systemBackup.findFirst({ where: { status: "ok" }, orderBy: { createdAt: "desc" } });

    if (!backupRow || !backupRow.data) {
      return NextResponse.json({ error: "Aucune sauvegarde disponible" }, { status: 404 });
    }

    const verify = await verifySystemBackup(backupRow.id);
    if (!verify.valid) {
      return NextResponse.json({ error: "La sauvegarde est corrompue. Restauration annulée." }, { status: 400 });
    }

    const dump = JSON.parse(backupRow.data);
    const bu = findBackupUser(dump, user.email);
    if (!bu) {
      return NextResponse.json({ error: "Aucune donnée pour ce compte dans la sauvegarde sélectionnée" }, { status: 404 });
    }

    const [liveGroupes, liveSeances, liveUserIds] = await Promise.all([
      prisma.groupe.findMany({ select: { id: true } }),
      prisma.seance.findMany({ select: { id: true } }),
      prisma.utilisateur.findMany({ select: { id: true } }),
    ]);
    const groupeIds = new Set(liveGroupes.map((g) => g.id));
    const seanceIds = new Set(liveSeances.map((s) => s.id));
    const userIds = new Set(liveUserIds.map((u) => u.id));

    const inscriptions = Array.isArray(dump.tables?.inscriptions) ? dump.tables.inscriptions : [];
    const paiements = Array.isArray(dump.tables?.paiements) ? dump.tables.paiements : [];
    const presences = Array.isArray(dump.tables?.presences) ? dump.tables.presences : [];
    const tauxBenefices = Array.isArray(dump.tables?.tauxBenefices) ? dump.tables.tauxBenefices : [];
    const notifications = Array.isArray(dump.tables?.notifications) ? dump.tables.notifications : [];

    const toDate = (v: any) => (v ? new Date(v) : null);
    const str = (v: any) => (v === undefined ? null : v);

    const restoredCounts = { inscriptions: 0, paiements: 0, presences: 0, tauxBenefice: 0, notifications: 0 };

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.inscription.deleteMany({ where: { eleveId: user.id } });
        await tx.paiement.deleteMany({ where: { eleveId: user.id } });
        await tx.presence.deleteMany({ where: { eleveId: user.id } });
        await tx.notification.deleteMany({ where: { destinataireId: user.id } });
        await tx.tauxBenefice.deleteMany({ where: { profId: user.id } });

        const profileData: any = {
          nom: bu.nom, prenom: bu.prenom, telephone: str(bu.telephone),
          image: str(bu.image), dateNaissance: toDate(bu.dateNaissance),
          niveau: str(bu.niveau), classe: str(bu.classe), filiere: str(bu.filiere),
          codeEleve: str(bu.codeEleve), codeProf: str(bu.codeProf),
          provider: bu.provider ?? "credentials", providerId: str(bu.providerId),
          emailVerified: toDate(bu.emailVerified),
          actif: true, deletedAt: null,
          passwordResetToken: null, passwordResetExpiry: null,
        };
        const hadPassword = !!bu.motDePasse;
        if (hadPassword) profileData.motDePasse = bu.motDePasse;

        await tx.utilisateur.update({ where: { id: user.id }, data: profileData });

        for (const ins of inscriptions) {
          if (ins.eleveId !== bu.id || !groupeIds.has(ins.groupeId)) continue;
          await tx.inscription.create({
            data: {
              id: ins.id, eleveId: user.id, groupeId: ins.groupeId,
              dateInscription: toDate(ins.dateInscription) ?? new Date(),
              statut: ins.statut || "actif",
            },
          }).catch(() => {});
          restoredCounts.inscriptions++;
        }

        for (const p of paiements) {
          if (p.eleveId !== bu.id || !groupeIds.has(p.groupeId)) continue;
          await tx.paiement.create({
            data: {
              id: p.id, eleveId: user.id, groupeId: p.groupeId,
              montant: Number(p.montant ?? 0),
              datePaiement: toDate(p.datePaiement) ?? new Date(),
              methodePaiement: p.methodePaiement,
              reference: str(p.reference), notes: str(p.notes),
              createdAt: toDate(p.createdAt) ?? new Date(),
            },
          }).catch(() => {});
          restoredCounts.paiements++;
        }

        for (const pr of presences) {
          if (pr.eleveId !== bu.id || !seanceIds.has(pr.seanceId)) continue;
          let enregistrePar: string | null = null;
          if (pr.enregistrePar) {
            if (pr.enregistrePar === bu.id) enregistrePar = user.id;
            else if (userIds.has(pr.enregistrePar)) enregistrePar = pr.enregistrePar;
          }
          await tx.presence.create({
            data: {
              id: pr.id, seanceId: pr.seanceId, eleveId: user.id,
              statut: pr.statut, enregistrePar,
              dateCreation: toDate(pr.dateCreation) ?? new Date(),
              dateModification: toDate(pr.dateModification) ?? new Date(),
            },
          }).catch(() => {});
          restoredCounts.presences++;
        }

        for (const t of tauxBenefices) {
          if (t.profId !== bu.id) continue;
          await tx.tauxBenefice.create({
            data: {
              id: t.id, profId: user.id, tauxPourcentage: Number(t.tauxPourcentage ?? 0),
              createdAt: toDate(t.createdAt) ?? new Date(),
              updatedAt: toDate(t.updatedAt) ?? new Date(),
            },
          }).catch(() => {});
          restoredCounts.tauxBenefice++;
        }

        for (const n of notifications) {
          if (n.destinataireId !== bu.id) continue;
          await tx.notification.create({
            data: {
              id: n.id, centerId: user.centerId, destinataireId: user.id,
              titre: n.titre, message: n.message, type: n.type,
              lu: !!n.lu, createdAt: toDate(n.createdAt) ?? new Date(),
            },
          }).catch(() => {});
          restoredCounts.notifications++;
        }

        return restoredCounts;
      },
      { timeout: 60_000 }
    );

    logger.info("Compte restauré depuis sauvegarde", {
      superAdminId: (session.user as any).id,
      userId: id,
      backupId: backupRow.id,
      version: backupRow.version,
      restoredCounts: result,
      passwordRestored: !!bu.motDePasse,
    });

    await prisma.systemLog.create({
      data: {
        action: "user_restored_from_backup",
        entity: "utilisateur",
        entityId: id,
        details: {
          backupId: backupRow.id, version: backupRow.version,
          email: user.email, restoredCounts: result,
          passwordRestored: !!bu.motDePasse,
        },
        userId: (session.user as any).id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Compte restauré depuis la sauvegarde",
      restoredCounts: result,
      passwordRestored: !!bu.motDePasse,
    });
  } catch (error) {
    logger.error("Erreur lors de la restauration du compte", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
