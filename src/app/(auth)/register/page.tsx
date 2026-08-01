"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { ArrowLeft } from "lucide-react";
import PasswordInput from "@/components/password-input";
import { useRouter } from "next/navigation";

const classesByNiveau: Record<string, string[]> = {
  primaire: ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année", "6ème année"],
  college: ["7ème", "8ème", "9ème"],
  lycee: ["1ère", "2ème", "3ème", "Bac"],
};

const filieres = [
  { value: "lettres", label: "Lettres" },
  { value: "economique", label: "Économique" },
  { value: "informatique", label: "Informatique" },
  { value: "technique", label: "Technique" },
  { value: "sciences", label: "Sciences" },
  { value: "math", label: "Mathématiques" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "eleve",
    },
  });

  const selectedRole = watch("role");
  const selectedNiveau = watch("niveau");
  const selectedClasse = watch("classe");

  const isEleve = selectedRole === "eleve";
  const availableClasses = selectedNiveau ? classesByNiveau[selectedNiveau] || [] : [];
  const showFiliere = selectedNiveau === "lycee" && selectedClasse && ["2ème", "3ème", "Bac"].includes(selectedClasse);

  async function onSubmit(data: RegisterInput) {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || "Une erreur est survenue.");
        return;
      }

      setSuccess("Compte créé avec succès. Vérifiez votre email pour activer votre compte, puis connectez-vous.");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>
      <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">
        Inscription
      </h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Créez votre compte
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="nom"
              className="mb-1 block text-sm font-medium text-[var(--foreground)]"
            >
              Nom
            </label>
            <input
              id="nom"
              type="text"
              placeholder="Dupont"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              {...register("nom")}
            />
            {errors.nom && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.nom.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="prenom"
              className="mb-1 block text-sm font-medium text-[var(--foreground)]"
            >
              Prénom
            </label>
            <input
              id="prenom"
              type="text"
              placeholder="Jean"
              className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              {...register("prenom")}
            />
            {errors.prenom && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.prenom.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-[var(--foreground)]"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="vous@exemple.com"
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="motDePasse"
            className="mb-1 block text-sm font-medium text-[var(--foreground)]"
          >
            Mot de passe
          </label>
          <PasswordInput
            id="motDePasse"
            placeholder="••••••••"
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            {...register("motDePasse")}
          />
          {errors.motDePasse && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.motDePasse.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="telephone"
            className="mb-1 block text-sm font-medium text-[var(--foreground)]"
          >
            Téléphone
          </label>
          <input
            id="telephone"
            type="tel"
            placeholder="+216 XX XXX XXX"
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            {...register("telephone")}
          />
          {errors.telephone && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.telephone.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="codeCentre"
            className="mb-1 block text-sm font-medium text-[var(--foreground)]"
          >
            Code du centre
          </label>
          <input
            id="codeCentre"
            type="text"
            placeholder="EX. 86UZGG"
            autoComplete="off"
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm uppercase tracking-widest text-[var(--foreground)] placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            {...register("codeCentre")}
          />
          {errors.codeCentre && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.codeCentre.message}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Demandez ce code à votre centre avant de vous inscrire.
          </p>
        </div>

        <div>
          <label
            htmlFor="role"
            className="mb-1 block text-sm font-medium text-[var(--foreground)]"
          >
            Rôle
          </label>
          <select
            id="role"
            className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            {...register("role")}
          >
            <option value="eleve">Élève</option>
            <option value="prof">Prof</option>
          </select>
          {errors.role && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.role.message}
            </p>
          )}
        </div>

        {isEleve && (
          <>
            <div>
              <label
                htmlFor="niveau"
                className="mb-1 block text-sm font-medium text-[var(--foreground)]"
              >
                Niveau scolaire
              </label>
              <select
                id="niveau"
                className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                {...register("niveau", { onChange: () => { setValue("classe", ""); setValue("filiere", undefined as any); } })}
              >
                <option value="">-- Sélectionner --</option>
                <option value="primaire">Primaire</option>
                <option value="college">Collège</option>
                <option value="lycee">Lycée</option>
              </select>
              {errors.niveau && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.niveau.message}
                </p>
              )}
            </div>

            {selectedNiveau && (
              <div>
                <label
                  htmlFor="classe"
                  className="mb-1 block text-sm font-medium text-[var(--foreground)]"
                >
                  Classe
                </label>
                <select
                  id="classe"
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  {...register("classe", { onChange: () => setValue("filiere", undefined as any) })}
                >
                  <option value="">-- Sélectionner --</option>
                  {availableClasses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.classe && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errors.classe.message}
                  </p>
                )}
              </div>
            )}

            {showFiliere && (
              <div>
                <label
                  htmlFor="filiere"
                  className="mb-1 block text-sm font-medium text-[var(--foreground)]"
                >
                  Filière
                </label>
                <select
                  id="filiere"
                  className="w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  {...register("filiere")}
                >
                  <option value="">-- Sélectionner --</option>
                  {filieres.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                {errors.filiere && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errors.filiere.message}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Inscription en cours..." : "S'inscrire"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
