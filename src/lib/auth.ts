import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

export const authOptions: NextAuthOptions = {
  providers: [
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

        const user = await prisma.utilisateur.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.motDePasse) {
          return null;
        }

        if (!user.actif) {
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
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.nom = user.nom;
        token.prenom = user.prenom;
        token.centerId = user.centerId;
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
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
