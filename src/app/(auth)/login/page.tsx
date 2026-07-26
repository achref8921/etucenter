"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { signIn, useSession } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        motDePasse: data.motDePasse,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect. Si vous venez de vous inscrire, votre compte doit être activé par un administrateur.");
      } else {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        const role = session?.user?.role;
        if (role === "super_admin") {
          router.push("/super-admin");
        } else if (role === "admin") {
          router.push("/admin");
        } else if (role === "prof") {
          router.push("/prof");
        } else {
          router.push("/eleve");
        }
        router.refresh();
      }
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
      <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-slate-100">
        Connexion
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Connectez-vous à votre compte
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="vous@exemple.com"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="motDePasse"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Mot de passe
          </label>
          <input
            id="motDePasse"
            type="password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            {...register("motDePasse")}
          />
          {errors.motDePasse && (
            <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
              {errors.motDePasse.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          S&apos;inscrire
        </Link>
      </p>
    </div>
  );
}
