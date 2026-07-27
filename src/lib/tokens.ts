import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken();
  const hashed = hashToken(token);

  await prisma.utilisateur.update({
    where: { id: userId },
    data: {
      passwordResetToken: hashed,
      passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  return token;
}

export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  const hashed = hashToken(token);

  const user = await prisma.utilisateur.findFirst({
    where: {
      passwordResetToken: hashed,
      passwordResetExpiry: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!user) return null;
  return user.id;
}

export async function consumePasswordResetToken(userId: string): Promise<void> {
  await prisma.utilisateur.update({
    where: { id: userId },
    data: {
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateToken();
  const hashed = hashToken(token);

  await prisma.utilisateur.update({
    where: { id: userId },
    data: {
      emailVerificationToken: hashed,
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  return token;
}

export async function verifyEmailVerificationToken(token: string): Promise<string | null> {
  const hashed = hashToken(token);

  const user = await prisma.utilisateur.findFirst({
    where: {
      emailVerificationToken: hashed,
      emailVerificationExpiry: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!user) return null;
  return user.id;
}

export async function consumeEmailVerificationToken(userId: string): Promise<void> {
  await prisma.utilisateur.update({
    where: { id: userId },
    data: {
      emailVerified: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });
}
