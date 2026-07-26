"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
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
  Building2,
  BarChart3,
  Database,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItemsByRole: Record<Role, NavItem[]> = {
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
    { label: "Notifications", href: "/prof/notifications", icon: Bell },
    { label: "Mon Profil", href: "/profil", icon: User },
  ],
  eleve: [
    { label: "Dashboard", href: "/eleve", icon: LayoutDashboard },
    { label: "Mes Groupes", href: "/eleve/groupes", icon: GraduationCap },
    { label: "Mes Seances", href: "/eleve/seances", icon: Calendar },
    { label: "Mes Paiements", href: "/eleve/paiements", icon: FileText },
    { label: "Mon Profil", href: "/profil", icon: User },
    { label: "Mes Presences", href: "/eleve/presences", icon: ClipboardCheck },
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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm transition-transform duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6 dark:border-slate-800">
          {centerLogo ? (
            <img src={centerLogo} alt="Logo" className="h-9 w-9 rounded-xl object-contain shadow-sm" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900/30">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{centerName || "GestExam"}</span>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {roleLabels[role]}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="text-[11px] text-slate-300 dark:text-slate-600">GestExam SaaS v1.0</p>
        </div>
      </aside>
    </>
  );
}
