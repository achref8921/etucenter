"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { navItemsByRole } from "./sidebar";

export default function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsByRole[role] || [];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/${role}` && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                )}
              />
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  isActive ? "bg-blue-600 dark:bg-blue-400" : "bg-transparent"
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
