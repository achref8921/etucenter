import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { rateLimit, getRateLimitKey, AUTH_RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const rlKey = getRateLimitKey(request, "forgot-password");
    const rl = rateLimit(rlKey, AUTH_RATE_LIMITS.forgotPassword);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const user = await prisma.utilisateur.findUnique({
      where: { email },
      select: { id: true, nom: true, prenom: true, motDePasse: true, provider: true },
    });

    if (!user || user.provider !== "credentials") {
      return NextResponse.json({
        message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
      });
    }

    const token = await createPasswordResetToken(user.id);
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const { subject, html } = passwordResetEmail(`${user.prenom} ${user.nom}`, resetUrl);
    await sendEmail({ to: email, subject, html });

    logger.info("Password reset requested", { userId: user.id, email });

    return NextResponse.json({
      message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
    });
  } catch (err) {
    logger.error("Forgot password error", { error: err });
    return NextResponse.json(
      { error: "Une erreur interne est survenue." },
      { status: 500 }
    );
  }
}
