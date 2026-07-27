import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { generateRandomCode } from "@/lib/utils";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendEmail, emailVerificationEmail } from "@/lib/email";
import { rateLimit, getRateLimitKey, AUTH_RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const rlKey = getRateLimitKey(request, "register");
    const rl = rateLimit(rlKey, AUTH_RATE_LIMITS.register);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || "Données invalides";
      logger.warn("Registration validation failed", { errors: parsed.error.flatten() });
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { nom, prenom, email, motDePasse, telephone, role, niveau, classe, filiere } = parsed.data;

    const existingUser = await prisma.utilisateur.findUnique({
      where: { email },
    });

    if (existingUser) {
      logger.info("Registration attempt with existing email", { email });
      return NextResponse.json(
        { error: "Un compte avec cet email existe déjà." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 12);

    let codeEleve: string | null = null;
    if (role === "eleve") {
      let code: string;
      let exists = true;
      while (exists) {
        code = generateRandomCode();
        const found = await prisma.utilisateur.findFirst({ where: { codeEleve: code } });
        exists = !!found;
      }
      codeEleve = code!;
    }

    const defaultCenterId = "00000000-0000-0000-0000-000000000001";

    const user = await prisma.utilisateur.create({
      data: {
        centerId: defaultCenterId,
        nom,
        prenom,
        email,
        motDePasse: hashedPassword,
        telephone,
        role,
        actif: false,
        codeEleve,
        provider: "credentials",
        niveau: role === "eleve" ? niveau : null,
        classe: role === "eleve" ? classe : null,
        filiere: role === "eleve" ? filiere : null,
      },
    });

    const token = await createEmailVerificationToken(user.id);
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    const { subject, html } = emailVerificationEmail(`${prenom} ${nom}`, verifyUrl);
    await sendEmail({ to: email, subject, html });

    logger.info("User registered successfully", {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const roleLabel = role === "eleve" ? "Élève" : "Prof";
    const admins = await prisma.utilisateur.findMany({
      where: { role: "admin", centerId: defaultCenterId },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          centerId: defaultCenterId,
          destinataireId: admin.id,
          titre: `Nouvel(le) ${roleLabel} inscrit(e)`,
          message: `${prenom} ${nom} (${email}) s'est inscrit(e) en tant que ${roleLabel}${niveau ? ` — ${classe}` : ""}. En attente d'activation.`,
          type: role === "eleve" ? "inscription_eleve" : "inscription_prof",
        })),
      });
    }

    return NextResponse.json(
      {
        message: "Compte créé avec succès. Vérifiez votre email pour activer votre compte.",
        user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("Registration error", { error: err });
    return NextResponse.json(
      { error: "Une erreur interne est survenue." },
      { status: 500 }
    );
  }
}
