import { z } from "zod";
import { todayDateInputValue, RATTRAPAGE_DATE_FUTURE_MESSAGE } from "./utils";

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
  motDePasse: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  telephone: z.string().optional(),
  codeCentre: z.string().min(1, "Le code du centre est requis"),
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
  motDePasse: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  telephone: z.string().optional(),
  role: z.enum(["admin", "prof", "eleve"]),
  dateNaissance: z.string().optional(),
  niveau: z.enum(["primaire", "college", "lycee"]).optional(),
  classe: z.string().optional(),
  filiere: z.enum(["lettres", "economique", "informatique", "technique", "sciences", "math"]).optional(),
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
      const lyceeClasses = ["2ème", "3ème", "Bac"];
      return lyceeClasses.includes(data.classe) ? !!data.filiere : true;
    }
    return true;
  },
  { message: "La filière est requise pour le lycée (2ème, 3ème, Bac)", path: ["filiere"] }
);

export const matiereSchema = z.object({
  nom: z.string().trim().min(2),
  description: z.string().trim().optional(),
});

export const groupeSchema = z.object({
  nom: z.string().min(2),
  description: z.string().optional(),
  profId: z.string().uuid().optional().nullable(),
  matiereId: z.string().uuid().optional().nullable(),
  prixParSeance: z.number().positive().optional(),
  forfaitMontant: z.number().positive().optional(),
  forfaitSeances: z.number().int().positive().optional(),
  capaciteMax: z.number().int().positive().optional(),
}).refine(
  (data) => {
    if (data.forfaitMontant !== undefined || data.forfaitSeances !== undefined) {
      return data.forfaitMontant !== undefined && data.forfaitSeances !== undefined;
    }
    return true;
  },
  {
    message: "Le montant et le nombre de séances du forfait doivent être fournis ensemble",
    path: ["forfaitMontant"],
  }
).refine(
  (data) => {
    if (data.forfaitMontant !== undefined || data.prixParSeance !== undefined) {
      return true;
    }
    return false;
  },
  {
    message: "Le prix par séance ou le forfait est requis",
    path: ["prixParSeance"],
  }
);

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
  timezoneOffset: z.number().optional(),
});

export const rattrapageSchema = z
  .object({
    eleveIds: z.array(z.string().uuid()).optional(),
    eleveId: z.string().uuid().optional(),
    groupeId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    heureDebut: z.string().regex(/^\d{1,2}:\d{2}$/, "Heure de début invalide").optional(),
    heureFin: z.string().regex(/^\d{1,2}:\d{2}$/, "Heure de fin invalide").optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      const ids = data.eleveIds && data.eleveIds.length > 0 ? data.eleveIds : data.eleveId ? [data.eleveId] : [];
      return ids.length > 0;
    },
    { message: "Sélectionnez au moins un élève", path: ["eleveIds"] }
  )
  .refine((data) => data.date <= todayDateInputValue(), {
    message: RATTRAPAGE_DATE_FUTURE_MESSAGE,
    path: ["date"],
  });

export const paiementSchema = z.object({
  eleveId: z.string().uuid(),
  groupeId: z.string().uuid(),
  montant: z.number().positive(),
  methodePaiement: z.enum(["especes", "virement", "cheque", "autre"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const teacherTransactionSchema = z.object({
  teacherId: z.string().uuid(),
  type: z.enum(["EARNING", "PAYMENT", "ADJUSTMENT"]),
  amount: z.number().positive("Le montant doit être positif"),
  credit: z.boolean().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  paymentMethod: z.enum(["especes", "virement", "cheque", "autre"]).optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const reverseTransactionSchema = z.object({
  reason: z.string().min(3, "La raison doit contenir au moins 3 caractères"),
});

const optionalDateString = z
  .string()
  .optional()
  .refine((v) => v === undefined || !Number.isNaN(new Date(v).getTime()), {
    message: "Date invalide",
  });

export const reverseCollectSchema = z.object({
  studentId: z.string().uuid("Identifiant élève invalide"),
  groupeId: z.string().uuid("Identifiant de groupe invalide"),
  amount: z.number().positive("Le montant doit être positif"),
  date: optionalDateString,
  notes: z.string().optional(),
});

export const reverseSettleSchema = z.object({
  amount: z.number().positive("Le montant doit être positif"),
  date: optionalDateString,
  notes: z.string().optional(),
});

export const studentTransactionSchema = z.object({
  studentId: z.string().uuid(),
  type: z.enum(["PREPAYMENT", "ADJUSTMENT"]),
  groupeId: z.string().uuid("Identifiant de groupe invalide").optional().nullable(),
  amount: z.number().positive("Le montant doit être positif"),
  credit: z.boolean().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  paymentMethod: z.enum(["especes", "virement", "cheque", "autre"]).optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().min(8, "Clé d'idempotence invalide").max(64).optional().nullable(),
});

export const notificationSendSchema = z.object({
  titre: z.string().min(2, "Le titre doit contenir au moins 2 caractères").max(255, "Le titre est trop long"),
  message: z.string().min(1, "Le message est requis").max(2000, "Le message est trop long"),
  destinataires: z.array(z.string().uuid("Identifiant invalide")).min(1, "Sélectionnez au moins un élève").max(200, "Trop de destinataires"),
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

// ─── Réorganisation des groupes (scission / fusion) ─────────────────────────
// Un « target » décrit un groupe cible : soit un groupe existant (groupeId),
// soit un nouveau groupe (nom + tarif). Chaque élève déplacé est décrit avec son
// groupe d'origine, ce qui permet de déplacer plusieurs groupes à la fois.

export const repartitionEleveSchema = z.object({
  eleveId: z.string().uuid("Identifiant élève invalide"),
  sourceGroupeId: z.string().uuid("Identifiant de groupe invalide"),
});

export const repartitionTargetSchema = z.object({
  key: z.string().min(1).max(60),
  groupeId: z.string().uuid().optional().nullable(),
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du groupe doit contenir au moins 2 caractères")
    .max(120, "Le nom du groupe est trop long")
    .optional()
    .nullable(),
  profId: z.string().uuid().optional().nullable(),
  matiereId: z.string().uuid().optional().nullable(),
  prixParSeance: z.number().positive("Prix par séance invalide").optional().nullable(),
  forfaitMontant: z.number().positive("Montant du forfait invalide").optional().nullable(),
  forfaitSeances: z.number().int().positive("Nombre de séances invalide").optional().nullable(),
  capaciteMax: z.number().int().positive().optional().nullable(),
  planningFromGroupeId: z.string().uuid().optional().nullable(),
  eleves: z
    .array(repartitionEleveSchema)
    .min(1, "Chaque groupe cible doit contenir au moins un élève")
    .max(500, "Trop d'élèves dans un même groupe cible"),
});

export const repartitionSchema = z
  .object({
    targets: z
      .array(repartitionTargetSchema)
      .min(1, "Au moins un groupe cible est requis")
      .max(20, "Trop de groupes cibles"),
    fusionnerHistorique: z.boolean().optional(),
    archiverSourcesVides: z.boolean().optional(),
    motDePasse: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const keys = new Set<string>();
    const eleves = new Set<string>();

    data.targets.forEach((target, index) => {
      if (keys.has(target.key)) {
        ctx.addIssue({
          code: "custom",
          message: "Référence de groupe cible en double",
          path: ["targets", index, "key"],
        });
      }
      keys.add(target.key);

      if (!target.groupeId) {
        if (!target.nom || target.nom.trim().length < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Le nom du nouveau groupe est requis",
            path: ["targets", index, "nom"],
          });
        }
        const hasForfait =
          (target.forfaitMontant ?? 0) > 0 && (target.forfaitSeances ?? 0) > 0;
        if (!hasForfait && !(target.prixParSeance && target.prixParSeance > 0)) {
          ctx.addIssue({
            code: "custom",
            message: "Indiquez un prix par séance ou un forfait pour le nouveau groupe",
            path: ["targets", index, "prixParSeance"],
          });
        }
      }

      target.eleves.forEach((eleve, eleveIndex) => {
        if (eleves.has(eleve.eleveId)) {
          ctx.addIssue({
            code: "custom",
            message: "Un élève ne peut être placé que dans un seul groupe cible",
            path: ["targets", index, "eleves", eleveIndex, "eleveId"],
          });
        }
        eleves.add(eleve.eleveId);
      });
    });
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UtilisateurInput = z.infer<typeof utilisateurSchema>;
export type MatiereInput = z.infer<typeof matiereSchema>;
export type GroupeInput = z.infer<typeof groupeSchema>;
export type SeanceInput = z.infer<typeof seanceSchema>;
export type PresenceInput = z.infer<typeof presenceSchema>;
export type RattrapageInput = z.infer<typeof rattrapageSchema>;
export type PaiementInput = z.infer<typeof paiementSchema>;
export type TeacherTransactionInput = z.infer<typeof teacherTransactionSchema>;
export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;
export type ReverseCollectInput = z.infer<typeof reverseCollectSchema>;
export type ReverseSettleInput = z.infer<typeof reverseSettleSchema>;
export type StudentTransactionInput = z.infer<typeof studentTransactionSchema>;
export type NotificationSendInput = z.infer<typeof notificationSendSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
