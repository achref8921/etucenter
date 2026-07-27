"use client";

import { signOut } from "next-auth/react";
import { AlertTriangle, LogOut } from "lucide-react";

export default function CentreSuspenduPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-red-50 to-slate-100 px-4 dark:from-slate-950 dark:via-red-950/20 dark:to-slate-900">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Centre Suspendu
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Votre centre a été suspendu par un administrateur. Vous ne pouvez plus accéder à votre compte pour le moment.
        </p>
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
          Contactez le support pour plus d&apos;informations.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-700 hover:shadow-xl dark:shadow-red-900/20"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
