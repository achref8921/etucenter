import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  motDePasse: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const niveauxScolaires = ["primaire", "college", "lycee"] as const;
const filieres = ["lettres", "economique", "informatique", "technique", "sciences", "math"] as const;

export const registerSchema = z.object({
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  motDePasse: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  telephone: z.string().optional(),
  role: z.enum(["prof", "eleve"]),
  niveau: z.enum(niveauxScolaires).optional(),
  classe: z.string().optional(),
  filiere: z.enum(filieres).optional(),
}).refine(
  (data) => {
    if (data.role === "eleve") {
      return !!data.niveau && !!data.classe;
    }
    return true;
  },
  { message: "Le niveau et la classe sont requis pour les élèves", path: ["niveau"] }
).refine(
  (data) => {
    if (data.role === "eleve" && data.niveau === "lycee" && data.classe) {
      const lycéeClasses = ["2ème", "1ère", "Bac"];
      return lycéeClasses.includes(data.classe) ? !!data.filiere : true;
    }
    return true;
  },
  { message: "La filière est requise pour le lycée (2ème, 3ème, Bac)", path: ["filiere"] }
);

export const utilisateurSchema = z.object({
  nom: z.string().min(2),
  prenom: z.string().min(2),
  email: z.string().email(),
  motDePasse: z.string().min(6).optional(),
  telephone: z.string().optional(),
  role: z.enum(["admin", "prof", "eleve"]),
  dateNaissance: z.string().optional(),
  niveau: z.enum(["primaire", "college", "lycee"]).optional(),
  classe: z.string().optional(),
  filiere: z.enum(["lettres", "economique", "informatique", "technique", "sciences", "math"]).optional(),
});

export const matiereSchema = z.object({
  nom: z.string().min(2),
  description: z.string().optional(),
});

export const groupeSchema = z.object({
  nom: z.string().min(2),
  description: z.string().optional(),
  profId: z.string().uuid().optional().nullable(),
  matiereId: z.string().uuid().optional().nullable(),
  prixParSeance: z.number().positive(),
  capaciteMax: z.number().int().positive().optional(),
});

export const seanceSchema = z.object({
  groupeId: z.string().uuid(),
  date: z.string(),
  heureDebut: z.string().optional(),
  heureFin: z.string().optional(),
  notes: z.string().optional(),
});

export const presenceSchema = z.object({
  seanceId: z.string().uuid(),
  presences: z.array(
    z.object({
      eleveId: z.string().uuid(),
      statut: z.enum(["present", "absent"]),
    })
  ),
});

export const paiementSchema = z.object({
  eleveId: z.string().uuid(),
  groupeId: z.string().uuid(),
  montant: z.number().positive(),
  methodePaiement: z.enum(["especes", "virement", "cheque", "autre"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requis"),
  motDePasse: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(8, "La confirmation doit contenir au moins 8 caractères"),
}).refine((data) => data.motDePasse === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UtilisateurInput = z.infer<typeof utilisateurSchema>;
export type MatiereInput = z.infer<typeof matiereSchema>;
export type GroupeInput = z.infer<typeof groupeSchema>;
export type SeanceInput = z.infer<typeof seanceSchema>;
export type PresenceInput = z.infer<typeof presenceSchema>;
export type PaiementInput = z.infer<typeof paiementSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
