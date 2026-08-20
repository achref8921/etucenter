"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@/types/role";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  Wallet,
  Calendar,
  ClipboardCheck,
  User,
  CreditCard,
  FileText,
  TrendingUp,
  Bell,
  Settings,
  BarChart3,
  Database,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const navItemsByRole: Record<Role, NavItem[]> = {
  super_admin: [
    { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Analytiques", href: "/admin/analytics", icon: BarChart3 },
    { label: "Utilisateurs", href: "/admin/utilisateurs", icon: Users },
    { label: "Groupes", href: "/admin/groupes", icon: GraduationCap },
    { label: "Matieres", href: "/admin/matieres", icon: BookOpen },
    { label: "Finances", href: "/admin/finances", icon: Wallet },
    { label: "Benefices", href: "/admin/benefices", icon: TrendingUp },
    { label: "Comptes Profs", href: "/admin/finances-professeurs", icon: CreditCard },
    { label: "Notifications", href: "/admin/notifications", icon: Bell },
    { label: "Backup & Restauration", href: "/admin/backup", icon: Database },
    { label: "Parametres", href: "/admin/parametres", icon: Settings },
    { label: "Mon Profil", href: "/profil", icon: User },
  ],
  prof: [
    { label: "Dashboard", href: "/prof", icon: LayoutDashboard },
    { label: "Mes Groupes", href: "/prof/groupes", icon: GraduationCap },
    { label: "Mes Seances", href: "/prof/seances", icon: Calendar },
    { label: "Mes Eleves", href: "/prof/eleves", icon: Users },
    { label: "Presences", href: "/prof/presences", icon: ClipboardCheck },
    { label: "Mon Compte", href: "/prof/compte", icon: Wallet },
    { label: "Notifications", href: "/prof/notifications", icon: Bell },
    { label: "Mon Profil", href: "/profil", icon: User },
  ],
  eleve: [
    { label: "Dashboard", href: "/eleve", icon: LayoutDashboard },
    { label: "Mes Groupes", href: "/eleve/groupes", icon: GraduationCap },
    { label: "Mes Seances", href: "/eleve/seances", icon: Calendar },
    { label: "Mes Paiements", href: "/eleve/paiements", icon: FileText },
    { label: "Mon Compte", href: "/eleve/compte", icon: Wallet },
    { label: "Mon Profil", href: "/profil", icon: User },
    { label: "Mes Presences", href: "/eleve/presences", icon: ClipboardCheck },
    { label: "Notifications", href: "/eleve/notifications", icon: Bell },
  ],
};

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Administrateur",
  prof: "Prof",
  eleve: "Eleve",
};

interface SidebarProps {
  role: Role;
  centerName?: string;
  centerLogo?: string | null;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ role, centerName, centerLogo, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const navItems = navItemsByRole[role];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform duration-300 ease-in-out dark:border-[#1e2128] dark:bg-[#141720]",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b border-neutral-100 px-5 dark:border-[#1e2128]">
          {centerLogo ? (
            <img src={centerLogo} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <img src="/icon-192.png" alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{centerName || "GestExam"}</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {roleLabels[role]}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${role}` && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                  isActive
                    ? "bg-indigo-50/80 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500 dark:bg-indigo-400" />
                )}
                <item.icon
                  className={cn(
                    "h-[17px] w-[17px] flex-shrink-0 transition-colors",
                    isActive ? "text-indigo-500 dark:text-indigo-400" : "text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-neutral-100 px-5 py-3 dark:border-[#1e2128]">
          <p className="text-[10px] text-neutral-300 dark:text-neutral-600">EduCenter v1.0</p>
        </div>
      </aside>
    </>
  );
}
