import { DefaultSession } from "next-auth";

export interface LinkedAccount {
  id: string;
  role: string;
  nom: string;
  prenom: string;
  email: string;
  centerId: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      nom: string;
      prenom: string;
      centerId: string;
      frozen?: boolean;
    } & DefaultSession["user"];
    linked?: LinkedAccount[];
  }

  interface User {
    role?: string;
    nom?: string;
    prenom?: string;
    centerId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    nom?: string;
    prenom?: string;
    centerId?: string;
    linked?: LinkedAccount[];
  }
}