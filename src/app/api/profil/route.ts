import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireActiveCenter } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const { session, error } = await requireActiveCenter();
    if (error) return error;

    const profil = await prisma.utilisateur.findUnique({
      where: { id: (session.user as any).id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        autresTelephones: true,
        role: true,
        dateNaissance: true,
        createdAt: true,
      },
    });

    if (!profil) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    return NextResponse.json(profil);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const body = await request.json();
    const { nom, prenom, telephone, autresTelephones, email, dateNaissance, motDePasse, ancienMotDePasse } = body;

    const userId = (session.user as any).id;
    const data: Record<string, any> = {};

    if (nom !== undefined) data.nom = nom;
    if (prenom !== undefined) data.prenom = prenom;
    if (telephone !== undefined) data.telephone = telephone || null;
    if (autresTelephones !== undefined) {
      data.autresTelephones = Array.isArray(autresTelephones) && autresTelephones.length > 0
        ? JSON.stringify(autresTelephones)
        : null;
    }
    if (dateNaissance !== undefined) data.dateNaissance = dateNaissance ? new Date(dateNaissance) : null;

    if (email !== undefined && email !== (session.user as any).email) {
      const existing = await prisma.utilisateur.findFirst({
        where: { email, deletedAt: null },
      });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
      }
      data.email = email;
    }

    if (motDePasse) {
      if (!ancienMotDePasse) {
        return NextResponse.json({ error: "L'ancien mot de passe est requis" }, { status: 400 });
      }

      const user = await prisma.utilisateur.findUnique({
        where: { id: userId },
        select: { motDePasse: true },
      });

      if (!user || !user.motDePasse) {
        return NextResponse.json({ error: "Compte sans mot de passe" }, { status: 400 });
      }

      const isValid = await bcrypt.compare(ancienMotDePasse, user.motDePasse);
      if (!isValid) {
        return NextResponse.json({ error: "Ancien mot de passe incorrect" }, { status: 400 });
      }

      if (motDePasse.length < 6) {
        return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
      }

      data.motDePasse = await bcrypt.hash(motDePasse, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à modifier" }, { status: 400 });
    }

    const profil = await prisma.utilisateur.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        autresTelephones: true,
        role: true,
        dateNaissance: true,
        createdAt: true,
      },
    });

    return NextResponse.json(profil);
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
