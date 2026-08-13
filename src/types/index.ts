import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  centerId: string;
  image?: string | null;
  frozen?: boolean;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalSeances: number;
  totalRevenue: number;
  totalUnpaid: number;
}

export interface StudentGroupStat {
  groupeId: string;
  groupeNom: string;
  prixParSeance: number;
  forfaitMontant?: number | null;
  forfaitSeances?: number | null;
  presencesCount: number;
  absencesCount: number;
  totalDue: number;
  totalPaid: number;
  unpaid: number;
}

export interface PresenceWithDetails {
  id: string;
  seanceId: string;
  eleveId: string;
  statut: "present" | "absent";
  dateCreation: Date;
  dateModification: Date;
  eleve: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  };
}

export interface SeanceWithDetails {
  id: string;
  date: Date;
  heureDebut: Date | null;
  heureFin: Date | null;
  statut: string;
  notes: string | null;
  groupe: {
    id: string;
    nom: string;
    prixParSeance: number;
    prof?: {
      id: string;
      nom: string;
      prenom: string;
    } | null;
  };
  _count?: {
    presences: number;
  };
}
