"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@/types/role";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  Wallet,
  ClipboardCheck,
  FileText,
  Bell,
  User,
  TrendingUp,
  Building2,
  Settings,
  BarChart3,
  UserPlus,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const bottomNavItems: Record<Role, NavItem[]> = {
  super_admin: [
    { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
    { label: "Centers", href: "/super-admin/centers", icon: Building2 },
    { label: "Users", href: "/super-admin/utilisateurs", icon: Users },
    { label: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
    { label: "Settings", href: "/super-admin/settings", icon: Settings },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Users", href: "/admin/utilisateurs", icon: Users },
    { label: "Groupes", href: "/admin/groupes", icon: GraduationCap },
    { label: "Finances", href: "/admin/benefices", icon: TrendingUp },
    { label: "Profil", href: "/profil", icon: User },
  ],
  prof: [
    { label: "Dashboard", href: "/prof", icon: LayoutDashboard },
    { label: "Groupes", href: "/prof/groupes", icon: GraduationCap },
    { label: "Seances", href: "/prof/seances", icon: Calendar },
    { label: "Eleves", href: "/prof/eleves", icon: Users },
    { label: "Presences", href: "/prof/presences", icon: ClipboardCheck },
  ],
  eleve: [
    { label: "Dashboard", href: "/eleve", icon: LayoutDashboard },
    { label: "Groupes", href: "/eleve/groupes", icon: GraduationCap },
    { label: "Seances", href: "/eleve/seances", icon: Calendar },
    { label: "Paiements", href: "/eleve/paiements", icon: FileText },
    { label: "Presences", href: "/eleve/presences", icon: ClipboardCheck },
  ],
};

export default function BottomNav({ role, variant = "indigo", peutGererEleves }: { role: Role; variant?: "indigo" | "violet"; peutGererEleves?: boolean }) {
  const pathname = usePathname();
  const baseItems = bottomNavItems[role] || [];
  const items =
    role === "prof" && peutGererEleves
      ? [{ label: "Élèves", href: "/prof/gestion-eleves", icon: UserPlus }, ...baseItems]
      : baseItems;
  const isActiveFn = (href: string) =>
    pathname === href ||
    (href !== `/${role}` && href !== "/super-admin" && pathname.startsWith(href));

  const activeColor = variant === "violet"
    ? "text-violet-600 dark:text-violet-400"
    : "text-indigo-600 dark:text-indigo-400";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-md md:hidden dark:border-[#1e2128] dark:bg-[#141720]/95">
      <div className="flex items-stretch">
        {items.map((item) => {
          const isActive = isActiveFn(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                isActive
                  ? activeColor
                  : "text-neutral-400 active:text-neutral-600 dark:text-neutral-500 dark:active:text-neutral-300"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? activeColor : "text-neutral-400 dark:text-neutral-500"
                )}
              />
              <span className="max-w-full truncate text-[10px] font-medium leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
