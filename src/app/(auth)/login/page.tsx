"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { signIn, useSession } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { ArrowLeft } from "lucide-react";
import PasswordInput from "@/components/password-input";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleError = searchParams.get("error");
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const errorMessages: Record<string, string> = {
    google_no_account:
      "Aucun compte associé à cet email. Demandez à votre administrateur de créer un compte d'abord.",
    Configuration: "Erreur de configuration. Veuillez réessayer.",
    AccessDenied: "Accès refusé. Veuillez réessayer.",
    session_conflict:
      "Un autre compte a été ouvert dans un autre onglet. Veuillez vous reconnecter.",
    Default: "Une erreur est survenue. Veuillez réessayer.",
  };

  if (googleError && !error) {
    setError(errorMessages[googleError] || errorMessages.Default);
  }

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
        setError(
          "Email ou mot de passe incorrect. Si vous venez de vous inscrire, votre compte doit être activé par un administrateur."
        );
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

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/super-admin" });
    } catch {
      setError("Erreur lors de la connexion avec Google.");
      setGoogleLoading(false);
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

      {googleClientId && (
        <>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            ) : (
              <GoogleIcon />
            )}
            {googleLoading
              ? "Connexion en cours..."
              : "Se connecter avec Google"}
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                ou
              </span>
            </div>
          </div>
        </>
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
          <PasswordInput
            id="motDePasse"
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

      <p className="mt-3 text-center text-sm">
        <Link
          href="/forgot-password"
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </p>

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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
