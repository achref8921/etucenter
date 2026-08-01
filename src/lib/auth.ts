import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateRandomCode } from "@/lib/utils";

export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

async function findAndValidateUser(email: string) {
  const user = await prisma.utilisateur.findUnique({
    where: { email },
  });

  if (!user || !user.motDePasse) {
    return null;
  }

  return user;
}

async function resolveDefaultCenterId(): Promise<string | null> {
  const preferred = await prisma.center.findFirst({
    where: { OR: [{ slug: "default" }, { slug: "platform" }] },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (preferred) return preferred.id;

  const first = await prisma.center.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

async function findOrCreateGoogleUser(
  email: string,
  name: string,
  image: string | null,
  providerId: string
) {
  let user = await prisma.utilisateur.findUnique({
    where: { email },
  });

  if (user) {
    if (user.provider === "credentials" && !user.providerId) {
      await prisma.utilisateur.update({
        where: { id: user.id },
        data: {
          provider: "google",
          providerId,
          emailVerified: user.emailVerified ?? new Date(),
          image: user.image ?? image,
        },
      });
    }
    return user;
  }

  const defaultCenterId = await resolveDefaultCenterId();
  if (!defaultCenterId) {
    throw new Error("Aucun centre disponible pour l'inscription");
  }
  const nameParts = name.split(" ");
  const prenom = nameParts[0] || "Utilisateur";
  const nom = nameParts.slice(1).join(" ") || "Google";

  let codeEleve: string | null = null;
  let exists = true;
  while (exists) {
    const code = generateRandomCode();
    const found = await prisma.utilisateur.findFirst({ where: { codeEleve: code } });
    exists = !!found;
    if (!exists) codeEleve = code;
  }

  user = await prisma.utilisateur.create({
    data: {
      centerId: defaultCenterId,
      nom,
      prenom,
      email,
      role: "eleve",
      actif: true,
      image,
      provider: "google",
      providerId,
      emailVerified: new Date(),
      codeEleve,
    },
  });

  logger.info("Google user auto-created", { userId: user.id, email });

  return user;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        motDePasse: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.motDePasse) {
          return null;
        }

        const user = await findAndValidateUser(credentials.email);

        if (!user || !user.motDePasse) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.motDePasse,
          user.motDePasse
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.prenom} ${user.nom}`,
          image: user.image,
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
          centerId: user.centerId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const dbUser = await findOrCreateGoogleUser(
            user.email ?? "",
            user.name ?? "Utilisateur Google",
            user.image ?? null,
            account.providerAccountId
          );
          user.id = dbUser.id;
          (user as any).role = dbUser.role;
          (user as any).nom = dbUser.nom;
          (user as any).prenom = dbUser.prenom;
          (user as any).centerId = dbUser.centerId;
          (user as any).image = dbUser.image;
          return true;
        } catch (err) {
          logger.error("Google sign-in error", { error: err, email: user.email });
          return "/login?error=google_no_account";
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.nom = (user as any).nom;
        token.prenom = (user as any).prenom;
        token.centerId = (user as any).centerId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.nom = token.nom as string;
        session.user.prenom = token.prenom as string;
        session.user.centerId = token.centerId as string;

        const role = token.role as string;
        const userId = token.id as string | undefined;
        let frozen = false;

        if (role !== "super_admin" && userId) {
          const dbUser = await prisma.utilisateur.findUnique({
            where: { id: userId },
            select: { actif: true, centerId: true },
          });

          if (!dbUser || !dbUser.actif) {
            frozen = true;
          }

          if (dbUser?.centerId) {
            const center = await prisma.center.findUnique({
              where: { id: dbUser.centerId },
              select: { active: true },
            });
            if (!center || !center.active) {
              frozen = true;
            }
          }
        }

        (session.user as any).frozen = frozen;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
