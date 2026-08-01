"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  Settings,
  Shield,
  BarChart3,
  Database,
  Users,
  Activity,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
  { label: "Centers", href: "/super-admin/centers", icon: Building2 },
  { label: "Utilisateurs", href: "/super-admin/utilisateurs", icon: Users },
  { label: "Analytiques", href: "/super-admin/analytics", icon: BarChart3 },
  { label: "Sauvegardes", href: "/super-admin/backups", icon: Database },
  { label: "Monitoring", href: "/super-admin/monitoring", icon: Activity },
  { label: "System Logs", href: "/super-admin/logs", icon: ScrollText },
  { label: "Settings", href: "/super-admin/settings", icon: Settings },
];

interface SuperAdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function SuperAdminSidebar({ open, onClose }: SuperAdminSidebarProps) {
  const pathname = usePathname();

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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-md shadow-violet-200 dark:shadow-violet-900/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">EduCenter</span>
            <p className="text-[10px] font-medium uppercase tracking-widest text-violet-500 dark:text-violet-400">
              Super Admin
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/super-admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-violet-50 text-violet-700 shadow-sm dark:bg-violet-900/20 dark:text-violet-400"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                    isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="text-[11px] text-slate-300 dark:text-slate-600">EduCenter Platform v1.0</p>
        </div>
      </aside>
    </>
  );
}
