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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/85 backdrop-blur-md px-4 sm:px-6 dark:border-[#1e2128] dark:bg-[#0f1114]/85">
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 rounded bg-violet-50 px-2 py-1 sm:px-2.5 dark:bg-violet-500/10">
          <Shield className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span className="hidden text-[11px] font-semibold text-violet-700 dark:text-violet-400 sm:inline">Platform Owner</span>
        </div>

        <button
          onClick={toggleTheme}
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>

        <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700/50" />

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-[11px] font-semibold text-white shadow-sm">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
              {user?.prenom} {user?.nom}
            </p>
            <span className="inline-block rounded bg-violet-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
              Super Admin
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 sm:px-2.5 dark:text-neutral-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Deconnexion</span>
        </button>
      </div>
    </header>
  );
}
