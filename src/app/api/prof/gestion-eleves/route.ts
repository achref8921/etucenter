import { NextRequest, NextResponse } from "next/server";
import { requireProfCanManageEleves } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateRandomCode, generateInitialPassword } from "@/lib/utils";
import { sendPushToUsers } from "@/lib/push";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const { session, error } = await requireProfCanManageEleves("GET");
    if (error) return error;

    const userId = (session.user as any).id;
    const centerId = (session.user as any).centerId;

    const groupes = await prisma.groupe.findMany({
      where: { profId: userId, centerId },
      select: {
        id: true,
        nom: true,
        description: true,
        capaciteMax: true,
        prixParSeance: true,
        forfaitMontant: true,
        forfaitSeances: true,
        matiere: { select: { id: true, nom: true } },
        inscriptions: {
          where: { statut: "actif", eleve: { deletedAt: null } },
          select: {
            id: true,
            dateInscription: true,
            eleve: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                email: true,
                telephone: true,
                codeEleve: true,
                niveau: true,
                classe: true,
                filiere: true,
              },
            },
          },
          orderBy: { dateInscription: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(groupes);
  } catch (error) {
    logger.error("Erreur lors de la récupération des élèves par le prof", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireProfCanManageEleves(request.method);
    if (error) return error;

    const userId = (session.user as any).id;
    const centerId = (session.user as any).centerId;

    const body = await request.json();

    // Existing student enrollment : { eleveId, groupeId }
    if (body.eleveId && body.groupeId) {
      const { eleveId, groupeId } = body;

      const groupe = await prisma.groupe.findFirst({ where: { id: groupeId, profId: userId, centerId } });
      if (!groupe) {
        return NextResponse.json({ error: "Groupe non trouvé ou non autorisé" }, { status: 404 });
      }

      const eleve = await prisma.utilisateur.findUnique({
        where: { id: eleveId, role: "eleve", centerId, deletedAt: null },
      });
      if (!eleve) {
        return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
      }

      const existingInscription = await prisma.inscription.findUnique({
        where: { eleveId_groupeId: { eleveId, groupeId } },
      });

      if (existingInscription) {
        if (existingInscription.statut === "actif") {
          return NextResponse.json(
            { error: "Cet élève est déjà inscrit dans ce groupe" },
            { status: 409 }
          );
        }
        const inscription = await prisma.inscription.update({
          where: { id: existingInscription.id },
          data: { statut: "actif" },
          include: {
            eleve: { select: { id: true, nom: true, prenom: true, codeEleve: true } },
            groupe: { select: { id: true, nom: true } },
          },
        });
        logger.info("Inscription réactivée par le prof", { userId, eleveId, groupeId });
        await notifyAdminsOfStudentAdd({
          centerId,
          elevePrenom: inscription.eleve.prenom,
          eleveNom: inscription.eleve.nom,
          groupeNom: inscription.groupe.nom,
          profPrenom: (session.user as any).prenom,
          profNom: (session.user as any).nom,
          action: "reactive",
        });
        return NextResponse.json(inscription, { status: 201 });
      }

      const capacityError = await checkCapacity(groupeId, groupe.capaciteMax);
      if (capacityError) return capacityError;

      const inscription = await prisma.inscription.create({
        data: { eleveId, groupeId },
        include: {
          eleve: { select: { id: true, nom: true, prenom: true, codeEleve: true } },
          groupe: { select: { id: true, nom: true } },
        },
      });

      logger.info("Élève existant inscrit par le prof", { userId, eleveId, groupeId });
      await notifyAdminsOfStudentAdd({
        centerId,
        elevePrenom: inscription.eleve.prenom,
        eleveNom: inscription.eleve.nom,
        groupeNom: inscription.groupe.nom,
        profPrenom: (session.user as any).prenom,
        profNom: (session.user as any).nom,
        action: "ajoute",
      });
      return NextResponse.json(inscription, { status: 201 });
    }

    // New student creation + enrollment : { nom, prenom, groupeId, email?, telephone?, niveau?, classe?, filiere?, motDePasse? }
    const { nom, prenom, groupeId, email, telephone, niveau, classe, filiere, motDePasse } = body;

    if (!nom || !prenom || !groupeId) {
      return NextResponse.json(
        { error: "nom, prenom et groupeId sont requis" },
        { status: 400 }
      );
    }

    const groupe = await prisma.groupe.findFirst({ where: { id: groupeId, profId: userId, centerId } });
    if (!groupe) {
      return NextResponse.json({ error: "Groupe non trouvé ou non autorisé" }, { status: 404 });
    }

    let finalEmail = email?.trim() || "";
    if (finalEmail) {
      const emailExists = await prisma.utilisateur.findUnique({ where: { email: finalEmail } });
      if (emailExists) {
        return NextResponse.json({ error: "Un utilisateur avec cet email existe déjà" }, { status: 409 });
      }
    }

    if (motDePasse !== undefined && (typeof motDePasse !== "string" || motDePasse.length < 6)) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }

    const initialPassword = motDePasse && motDePasse.trim() ? motDePasse : generateInitialPassword();

    let codeEleve: string;
    let exists = true;
    while (exists) {
      codeEleve = generateRandomCode();
      const found = await prisma.utilisateur.findFirst({ where: { codeEleve, centerId } });
      exists = !!found;
    }

    const eleveCode = codeEleve!;

    const validNiveaux = ["primaire", "college", "lycee"];
    if (niveau && !validNiveaux.includes(niveau)) {
      return NextResponse.json({ error: "Niveau invalide" }, { status: 400 });
    }

    const capacityError = await checkCapacity(groupeId, groupe.capaciteMax);
    if (capacityError) return capacityError;

    const loginEmail = finalEmail || `eleve-${eleveCode}-${centerId.slice(0, 8)}@etucenter.local`;

    const eleve = await prisma.utilisateur.create({
      data: {
        centerId,
        nom: (nom as string).trim(),
        prenom: (prenom as string).trim(),
        email: loginEmail,
        motDePasse: await bcrypt.hash(initialPassword, 12),
        role: "eleve",
        actif: true,
        telephone: telephone?.trim() || null,
        niveau: niveau || null,
        classe: classe?.trim() || null,
        filiere: filiere || null,
        codeEleve: eleveCode,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        codeEleve: true,
        niveau: true,
        classe: true,
        filiere: true,
      },
    });

    const inscription = await prisma.inscription.create({
      data: { eleveId: eleve.id, groupeId },
      include: {
        groupe: { select: { id: true, nom: true } },
      },
    });

    logger.info("Élève créé et inscrit par le prof", {
      userId,
      eleveId: eleve.id,
      codeEleve: eleveCode,
      groupeId,
    });

    await notifyAdminsOfStudentAdd({
      centerId,
      elevePrenom: eleve.prenom,
      eleveNom: eleve.nom,
      groupeNom: inscription.groupe.nom,
      profPrenom: (session.user as any).prenom,
      profNom: (session.user as any).nom,
      action: "ajoute",
    });

    return NextResponse.json(
      {
        eleve,
        inscription,
        credentials: {
          email: loginEmail,
          motDePasse: initialPassword,
          codeEleve: eleveCode,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Erreur lors de la création de l'élève par le prof", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireProfCanManageEleves(request.method);
    if (error) return error;

    const userId = (session.user as any).id;
    const centerId = (session.user as any).centerId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const eleveId = searchParams.get("eleveId");
    const groupeId = searchParams.get("groupeId");

    let inscription;

    if (id) {
      inscription = await prisma.inscription.findFirst({
        where: { id, groupe: { profId: userId, centerId } },
      });
    } else if (eleveId && groupeId) {
      inscription = await prisma.inscription.findFirst({
        where: { eleveId, groupeId, groupe: { profId: userId, centerId } },
      });
    } else {
      return NextResponse.json(
        { error: "Paramètre id ou (eleveId et groupeId) requis" },
        { status: 400 }
      );
    }

    if (!inscription) {
      return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
    }

    await prisma.inscription.update({
      where: { id: inscription.id },
      data: { statut: "inactif" },
    });

    logger.info("Élève retiré du groupe par le prof", {
      userId,
      inscriptionId: inscription.id,
      eleveId: inscription.eleveId,
      groupeId: inscription.groupeId,
    });

    return NextResponse.json({ message: "Élève retiré du groupe avec succès" });
  } catch (error) {
    logger.error("Erreur lors du retrait de l'élève par le prof", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

async function checkCapacity(groupeId: string, capaciteMax: number | null) {
  if (!capaciteMax) return null;

  const currentCount = await prisma.inscription.count({
    where: { groupeId, statut: "actif" },
  });

  if (currentCount >= capaciteMax) {
    return NextResponse.json(
      { error: "Le groupe a atteint sa capacité maximale" },
      { status: 400 }
    );
  }

  return null;
}

async function notifyAdminsOfStudentAdd(params: {
  centerId: string;
  elevePrenom: string;
  eleveNom: string;
  profPrenom: string;
  profNom: string;
  groupeNom: string;
  action: "ajoute" | "reactive";
}) {
  const admins = await prisma.utilisateur.findMany({
    where: { role: "admin", centerId: params.centerId, deletedAt: null },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const heureStr = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nomEleve = `${params.elevePrenom} ${params.eleveNom}`;
  const nomProf = `${params.profPrenom} ${params.profNom}`;
  const titre =
    params.action === "reactive"
      ? "Élève réinscrit par un prof"
      : "Nouvel élève ajouté par un prof";
  const message =
    params.action === "reactive"
      ? `${nomEleve} a été réinscrit au groupe « ${params.groupeNom} » par ${nomProf} le ${dateStr} à ${heureStr}.`
      : `${nomEleve} a été ajouté au groupe « ${params.groupeNom} » par ${nomProf} le ${dateStr} à ${heureStr}.`;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      centerId: params.centerId,
      destinataireId: admin.id,
      titre,
      message,
      type: "ajout_eleve_prof",
    })),
  });

  await sendPushToUsers(
    admins.map((admin) => admin.id),
    { title: titre, body: message, url: "/admin/notifications" }
  ).catch(() => {});

  logger.info("Notification d'ajout d'élève envoyée aux admins", {
    centerId: params.centerId,
    count: admins.length,
  });
}