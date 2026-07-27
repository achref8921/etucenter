import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendEmail, emailVerificationEmail } from "@/lib/email";
import { rateLimit, getRateLimitKey, AUTH_RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const rlKey = getRateLimitKey(request, "resend-verification");
    const rl = rateLimit(rlKey, { windowMs: 60 * 60 * 1000, max: 3 });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const user = await prisma.utilisateur.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, nom: true, prenom: true, emailVerified: true, provider: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email déjà vérifié." });
    }

    if (user.provider !== "credentials") {
      return NextResponse.json({ message: "Compte Google. Pas de vérification nécessaire." });
    }

    const token = await createEmailVerificationToken(user.id);
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    const { subject, html } = emailVerificationEmail(`${user.prenom} ${user.nom}`, verifyUrl);
    await sendEmail({ to: user.email, subject, html });

    logger.info("Verification email resent", { userId: user.id });

    return NextResponse.json({ message: "Email de vérification envoyé." });
  } catch (err) {
    logger.error("Resend verification error", { error: err });
    return NextResponse.json(
      { error: "Une erreur interne est survenue." },
      { status: 500 }
    );
  }
}
