"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, Menu, Sun, Moon, ImageOff, Image as ImageIcon } from "lucide-react";
import AccountSwitcher from "@/components/account-switcher";
import NotificationBellDropdown from "@/components/notification-bell-dropdown";
import UserAvatar from "@/components/user-avatar";
import { useTheme } from "@/components/theme-provider";
import { useWatermarkEnabled } from "@/components/layout/center-watermark";
import type { AccountUser } from "@/types/next-auth";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrateur",
  prof: "Prof",
  eleve: "Eleve",
};

interface HeaderProps {
  centerLogo?: string | null;
  onMenuToggle?: () => void;
  fallbackUser?: AccountUser | null;
}

export default function Header({ centerLogo, onMenuToggle, fallbackUser }: HeaderProps) {
  const { data: session } = useSession();
  const user = session?.user ?? fallbackUser;
  const role = (user?.role as string) || "";
  const avatarVersion = user?.image?.match(/[?&]v=(\d+)/)?.[1] ?? null;
  const { theme, toggleTheme } = useTheme();
  const { enabled: watermarkEnabled, toggle: toggleWatermark } = useWatermarkEnabled();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/85 px-4 backdrop-blur-md sm:px-6 dark:border-[#1e2128] dark:bg-[#0f1114]/85">
      <div className="flex items-center gap-1.5">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <img
          src={centerLogo || "/logo.svg"}
          alt="Logo"
          className="h-8 w-8 rounded-[var(--radius-md)] object-contain md:hidden"
        />
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1.5">
        <NotificationBellDropdown role={role} />

        {centerLogo && (
          <button
            onClick={toggleWatermark}
            className="hidden h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 sm:flex dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            title={watermarkEnabled ? "Masquer le logo en filigrane" : "Afficher le logo en filigrane"}
            aria-pressed={watermarkEnabled}
          >
            {watermarkEnabled ? <ImageIcon className="h-[18px] w-[18px]" /> : <ImageOff className="h-[18px] w-[18px]" />}
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </button>

        <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700/50" />

        <AccountSwitcher
          fallbackUser={fallbackUser}
          triggerClassName="group -mx-1 flex items-center gap-2 rounded-[var(--radius-md)] px-1 py-0.5 text-left transition-colors hover:bg-neutral-100 sm:gap-2.5 dark:hover:bg-neutral-800"
          trigger={
            <>
              <UserAvatar
                key={user?.image ?? "no-avatar"}
                userId={user?.id}
                nom={user?.nom}
                prenom={user?.prenom}
                hasImage={Boolean(user?.image)}
                version={avatarVersion}
                size="xs"
                className="shadow-xs"
                fallbackClassName="bg-[var(--primary)] text-[var(--primary-foreground)]"
              />
              <div className="hidden sm:block">
                <p className="text-[var(--text-body)] font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
                  {user?.prenom} {user?.nom}
                </p>
                <span className="mt-0.5 inline-block rounded bg-[var(--primary)]/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)] dark:text-[var(--accent-foreground)]">
                  {roleLabels[role] || role}
                </span>
              </div>
            </>
          }
        />

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
