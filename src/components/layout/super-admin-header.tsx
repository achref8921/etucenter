"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, Shield, Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface SuperAdminHeaderProps {
  onMenuToggle?: () => void;
}

export default function SuperAdminHeader({ onMenuToggle }: SuperAdminHeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-6 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 rounded-full bg-violet-50 px-2 py-1 sm:px-3 dark:bg-violet-900/20">
          <Shield className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span className="hidden text-xs font-semibold text-violet-700 dark:text-violet-400 sm:inline">Platform Owner</span>
        </div>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-xs font-semibold text-white shadow-sm sm:h-9 sm:w-9 sm:text-sm">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {user?.prenom} {user?.nom}
            </p>
            <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              Super Admin
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 sm:px-3 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
