import { DefaultSession } from "next-auth";

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
  }
}
