"use client";

import { signOut } from "next-auth/react";
import { Wrench, LogOut } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50 to-slate-100 px-4 dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-900">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
          <Wrench className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Maintenance en cours
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          La plateforme est temporairement en maintenance. Veuillez réessayer dans quelques instants.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-200 transition-all hover:bg-amber-700 hover:shadow-xl dark:shadow-amber-900/20"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
