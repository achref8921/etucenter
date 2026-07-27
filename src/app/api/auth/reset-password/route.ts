import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations";
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/tokens";
import { rateLimit, getRateLimitKey, AUTH_RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const rlKey = getRateLimitKey(request, "reset-password");
    const rl = rateLimit(rlKey, AUTH_RATE_LIMITS.resetPassword);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { token, motDePasse } = parsed.data;
    const userId = await verifyPasswordResetToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: "Le lien de réinitialisation est invalide ou a expiré." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 12);

    await prisma.utilisateur.update({
      where: { id: userId },
      data: {
        motDePasse: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    logger.info("Password reset completed", { userId });

    return NextResponse.json({
      message: "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
    });
  } catch (err) {
    logger.error("Reset password error", { error: err });
    return NextResponse.json(
      { error: "Une erreur interne est survenue." },
      { status: 500 }
    );
  }
}
