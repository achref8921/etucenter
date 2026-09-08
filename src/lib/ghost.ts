import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface GhostImpact {
  role: "eleve" | "prof";
  soldeNet: number;
  transactions: number;
  inscriptions: number;
  paiements: { count: number; montant: number };
  presences: number;
  gainsProf: { count: number; montant: number };
  notifications: number;
}

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function ghostifyAccount(userId: string): Promise<{ role: "eleve" | "prof"; nom: string; prenom: string; email: string; soldeNet: number }> {
  const user = await prisma.utilisateur.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error("Utilisateur non trouvé");
  }

  if (user.role !== "eleve" && user.role !== "prof") {
    throw new Error("Seuls les comptes élèves et professeurs peuvent être supprimés de cette façon");
  }

  if (user.ghost) {
    throw new Error("Ce compte a déjà été supprimé");
  }

  const role = user.role;

  const result = await prisma.$transaction(async (tx) => {
    if (role === "prof") {
      await tx.groupe.updateMany({
        where: { profId: userId },
        data: { profId: null },
      });
    }

    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { destinataireId: userId } });

    const [studentActive, teacherActive] = await Promise.all([
      role === "eleve"
        ? tx.studentTransaction.aggregate({
            _sum: { signedAmount: true },
            where: { eleveId: userId, status: "active" },
          })
        : Promise.resolve({ _sum: { signedAmount: null } }),
      role === "prof"
        ? tx.teacherTransaction.aggregate({
            _sum: { signedAmount: true },
            where: { teacherId: userId, status: "active" },
          })
        : Promise.resolve({ _sum: { signedAmount: null } }),
    ]);

    await tx.utilisateur.update({
      where: { id: userId },
      data: {
        ghost: true,
        actif: false,
        motDePasse: null,
        provider: "ghost",
        providerId: null,
        image: null,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    await tx.systemLog.create({
      data: {
        action: role === "prof" ? "teacher_account_purged_to_ghost" : "student_account_purged_to_ghost",
        entity: "utilisateur",
        entityId: userId,
        details: {
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          code: role === "eleve" ? user.codeEleve : user.codeProf,
        },
      },
    });

    return {
      role,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      soldeNet: role === "eleve" ? toNumber(studentActive._sum.signedAmount) : toNumber(teacherActive._sum.signedAmount),
    };
  });

  logger.info("Compte transformé en fantôme", { userId, email: user.email, role });

  return result;
}

export async function buildGhostDeleteImpact(centerId: string, userId: string): Promise<GhostImpact> {
  const user = await prisma.utilisateur.findUnique({ where: { id: userId } });

  if (!user || user.centerId !== centerId) {
    throw new Error("Utilisateur non trouvé");
  }

  if (!user.ghost) {
    throw new Error("Seuls les comptes supprimés (fantômes) peuvent être effacés définitivement");
  }

  const role = user.role;
  if (role !== "eleve" && role !== "prof") {
    throw new Error("Ce compte ne peut pas être effacé de cette façon");
  }

  const [transactions, studentBal, inscriptions, paiements, presences, teacherTx] = await Promise.all([
    role === "eleve"
      ? prisma.studentTransaction.count({ where: { eleveId: userId } })
      : prisma.teacherTransaction.count({ where: { teacherId: userId } }),
    role === "eleve"
      ? prisma.studentTransaction.aggregate({
          _sum: { signedAmount: true },
          where: { eleveId: userId, status: "active" },
        })
      : Promise.resolve({ _sum: { signedAmount: null } }),
    prisma.inscription.count({ where: { eleveId: userId } }),
    prisma.paiement.aggregate({
      _sum: { montant: true },
      where: { eleveId: userId },
    }),
    prisma.presence.count({ where: { eleveId: userId } }),
    role === "prof"
      ? prisma.teacherTransaction.aggregate({
          _sum: { signedAmount: true },
          where: { teacherId: userId, status: "active" },
          _count: true,
        })
      : Promise.resolve({ _sum: { signedAmount: null }, _count: 0 }),
  ]);

  const paiementList = await prisma.paiement.findMany({ where: { eleveId: userId }, select: { id: true } });

  const impact: GhostImpact = {
    role,
    soldeNet: role === "eleve" ? toNumber(studentBal._sum.signedAmount) : toNumber(teacherTx._sum.signedAmount),
    transactions,
    inscriptions,
    paiements: { count: paiementList.length, montant: toNumber(paiements._sum.montant) },
    presences,
    gainsProf:
      role === "prof"
        ? { count: teacherTx._count as number, montant: toNumber(teacherTx._sum.signedAmount) }
        : { count: 0, montant: 0 },
    notifications: await prisma.notification.count({ where: { destinataireId: userId } }),
  };

  return impact;
}

export async function deleteGhostAccount(
  centerId: string,
  userId: string,
  actorId: string
): Promise<GhostImpact> {
  const user = await prisma.utilisateur.findUnique({ where: { id: userId } });

  if (!user || user.centerId !== centerId) {
    throw new Error("Utilisateur non trouvé");
  }

  if (!user.ghost) {
    throw new Error("Seuls les comptes supprimés (fantômes) peuvent être effacés définitivement");
  }

  const role = user.role;
  if (role !== "eleve" && role !== "prof") {
    throw new Error("Ce compte ne peut pas être effacé de cette façon");
  }

  const impact = await buildGhostDeleteImpact(centerId, userId);

  await prisma.$transaction(async (tx) => {
    if (role === "eleve") {
      await tx.studentTransaction.deleteMany({ where: { eleveId: userId } });
      await tx.inscription.deleteMany({ where: { eleveId: userId } });
      await tx.paiement.deleteMany({ where: { eleveId: userId } });
      await tx.presence.deleteMany({ where: { eleveId: userId } });
    } else {
      await tx.teacherTransaction.deleteMany({ where: { teacherId: userId } });
      await tx.tauxBenefice.deleteMany({ where: { profId: userId } });
      await tx.groupe.updateMany({ where: { profId: userId }, data: { profId: null } });
      await tx.presence.updateMany({ where: { enregistrePar: userId }, data: { enregistrePar: null } });
    }

    await tx.notification.deleteMany({ where: { destinataireId: userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });

    await tx.systemLog.create({
      data: {
        action: role === "prof" ? "ghost_teacher_deleted_permanently" : "ghost_student_deleted_permanently",
        entity: "utilisateur",
        entityId: userId,
        details: {
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          code: role === "eleve" ? user.codeEleve : user.codeProf,
          actorId,
        },
      },
    });

    await tx.utilisateur.delete({ where: { id: userId } });
  });

  logger.info("Fantôme supprimé définitivement", { userId, email: user.email, role, actorId });

  return impact;
}