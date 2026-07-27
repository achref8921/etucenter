import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

async function findAndValidateUser(email: string) {
  const user = await prisma.utilisateur.findUnique({
    where: { email },
  });

  if (!user || !user.actif) {
    return null;
  }

  if (user.centerId && user.role !== "super_admin") {
    const center = await prisma.center.findUnique({
      where: { id: user.centerId },
      select: { active: true },
    });
    if (!center || !center.active) {
      return null;
    }
  }

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
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const dbUser = await findAndValidateUser(user.email ?? "");
        if (!dbUser) {
          return "/login?error=google_no_account";
        }
        user.id = dbUser.id;
        (user as any).role = dbUser.role;
        (user as any).nom = dbUser.nom;
        (user as any).prenom = dbUser.prenom;
        (user as any).centerId = dbUser.centerId;
        (user as any).image = dbUser.image;
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
