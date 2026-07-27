import { NextResponse } from "next/server";
import { verifyEmailVerificationToken, consumeEmailVerificationToken } from "@/lib/tokens";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/verify-email?status=invalid", process.env.NEXTAUTH_URL || "http://localhost:3000"));
    }

    const userId = await verifyEmailVerificationToken(token);

    if (!userId) {
      return NextResponse.redirect(new URL("/verify-email?status=expired", process.env.NEXTAUTH_URL || "http://localhost:3000"));
    }

    await consumeEmailVerificationToken(userId);

    logger.info("Email verified", { userId });

    return NextResponse.redirect(new URL("/verify-email?status=success", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  } catch (err) {
    logger.error("Email verification error", { error: err });
    return NextResponse.redirect(new URL("/verify-email?status=error", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }
}
