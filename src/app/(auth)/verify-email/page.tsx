"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { CheckCircle, AlertTriangle, Mail, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resentError, setResentError] = useState<string | null>(null);

  async function handleResend() {
    setResending(true);
    setResentError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setResent(true);
      } else {
        setResentError(body.error || "Erreur lors de l'envoi.");
      }
    } catch {
      setResentError("Une erreur est survenue.");
    } finally {
      setResending(false);
    }
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
          Email vérifié
        </h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Votre adresse email a été vérifiée avec succès. Vous pouvez maintenant accéder à votre compte.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
          Lien expiré
        </h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Le lien de vérification a expiré. Demandez un nouveau lien.
        </p>
        {!resent ? (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
          >
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {resending ? "Envoi..." : "Renvoyer l'email"}
          </button>
        ) : (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Email renvoyé. Vérifiez votre boîte de réception.
          </p>
        )}
        {resentError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{resentError}</p>
        )}
      </div>
    );
  }

  if (status === "invalid" || status === "error") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
          Lien invalide
        </h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Ce lien de vérification est invalide. Vérifiez votre email pour le bon lien.
        </p>
        {!resent ? (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
          >
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {resending ? "Envoi..." : "Renvoyer l'email"}
          </button>
        ) : (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Email renvoyé. Vérifiez votre boîte de réception.
          </p>
        )}
        {resentError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{resentError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
        <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
        Vérifiez votre email
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Un email de vérification vous a été envoyé. Cliquez sur le lien dans l&apos;email pour activer votre compte.
      </p>
      <div className="space-y-3">
        {!resent ? (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 disabled:opacity-50"
          >
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {resending ? "Envoi..." : "Renvoyer l'email"}
          </button>
        ) : (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Email renvoyé avec succès.
          </p>
        )}
        {resentError && (
          <p className="text-sm text-red-600 dark:text-red-400">{resentError}</p>
        )}
        <div>
          <Link
            href="/login"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
