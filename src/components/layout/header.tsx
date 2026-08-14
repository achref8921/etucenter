"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, Menu, Sun, Moon } from "lucide-react";
import NotificationBellDropdown from "@/components/notification-bell-dropdown";
import { useTheme } from "@/components/theme-provider";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrateur",
  prof: "Prof",
  eleve: "Eleve",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  prof: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  eleve: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

interface HeaderProps {
  centerLogo?: string | null;
  onMenuToggle?: () => void;
}

export default function Header({ centerLogo, onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user?.role as string) || "";
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-6 md:h-16 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center gap-1.5">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <img
          src={centerLogo || "/icon-192.png"}
          alt="Logo"
          className="h-9 w-9 rounded-lg object-contain md:hidden"
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBellDropdown role={role} />

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-semibold text-white shadow-sm sm:h-9 sm:w-9 sm:text-sm">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {user?.prenom} {user?.nom}
            </p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleColors[role] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
              {roleLabels[role] || role}
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 sm:px-3 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Deconnexion</span>
        </button>
      </div>
    </header>
  );
}
