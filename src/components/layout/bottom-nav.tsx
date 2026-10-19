"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@/types/role";
import { cn } from "@/lib/utils";
import { getBottomNav, isHrefActive, roleHome } from "./nav-config";

export default function BottomNav({
  role,
  variant = "blue",
}: {
  role: Role;
  variant?: "blue" | "violet";
  peutGererEleves?: boolean;
  peutEncaisserReverse?: boolean;
}) {
  const pathname = usePathname();
  const home = roleHome(role);
  const items = getBottomNav(role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-md md:hidden dark:border-[#1e2128] dark:bg-[#141720]/95">
      <div className="flex items-stretch">
        {items.map((item) => {
          const active = isHrefActive(pathname, item.href, home);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 transition-colors duration-200",
                active
                  ? variant === "violet"
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-blue-700 dark:text-blue-400"
                  : "text-neutral-400 active:text-neutral-600 dark:text-neutral-500 dark:active:text-neutral-300"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-2 top-0 h-[2px] origin-center rounded-full transition-all duration-300 ease-out motion-reduce:transition-none",
                  active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
                  variant === "violet" ? "bg-violet-600 dark:bg-violet-400" : "bg-blue-700 dark:bg-blue-400"
                )}
              />
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
                  active && "-translate-y-px",
                  active
                    ? variant === "violet"
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-blue-700 dark:text-blue-400"
                    : "text-neutral-400 dark:text-neutral-500"
                )}
              />
              <span className="w-full truncate text-center text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
