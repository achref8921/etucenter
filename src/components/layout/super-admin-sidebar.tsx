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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform duration-300 ease-in-out dark:border-[#1e2128] dark:bg-[#141720]",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b border-neutral-100 px-5 dark:border-[#1e2128]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">EduCenter</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-violet-500 dark:text-violet-400">
              Super Admin
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3 overflow-y-auto">
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
                  "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                  isActive
                    ? "bg-violet-50/80 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-violet-500 dark:bg-violet-400" />
                )}
                <item.icon
                  className={cn(
                    "h-[17px] w-[17px] flex-shrink-0 transition-colors",
                    isActive ? "text-violet-500 dark:text-violet-400" : "text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-neutral-100 px-5 py-3 dark:border-[#1e2128]">
          <p className="text-[10px] text-neutral-300 dark:text-neutral-600">EduCenter Platform v1.0</p>
        </div>
      </aside>
    </>
  );
}
