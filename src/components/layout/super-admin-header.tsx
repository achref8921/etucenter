"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, Shield, Menu, Sun, Moon } from "lucide-react";
import UserAvatar from "@/components/user-avatar";
import { useTheme } from "@/components/theme-provider";

interface SuperAdminHeaderProps {
  onMenuToggle?: () => void;
}

export default function SuperAdminHeader({ onMenuToggle }: SuperAdminHeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const avatarVersion = user?.image?.match(/[?&]v=(\d+)/)?.[1] ?? null;
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/85 backdrop-blur-md px-4 sm:px-6 dark:border-[#1e2128] dark:bg-[#0f1114]/85">
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1.5">
        <div className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-blue-50 px-2 py-1 sm:px-2.5 dark:bg-blue-500/10">
          <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden text-[11px] font-semibold text-blue-700 dark:text-blue-400 sm:inline">Platform Owner</span>
        </div>

        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>

        <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700/50" />

        <div className="flex items-center gap-2 sm:gap-2.5">
          <UserAvatar
            key={user?.image ?? "no-avatar"}
            userId={user?.id}
            nom={user?.nom}
            prenom={user?.prenom}
            hasImage={Boolean(user?.image)}
            version={avatarVersion}
            size="xs"
            className="shadow-xs"
            fallbackClassName="bg-blue-600 text-white"
          />
          <div className="hidden sm:block">
            <p className="text-[var(--text-body)] font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
              {user?.prenom} {user?.nom}
            </p>
            <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              Super Admin
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Deconnexion"
          className="flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[var(--text-body)] font-medium text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 sm:px-2.5 dark:text-neutral-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Deconnexion</span>
        </button>
      </div>
    </header>
  );
}
