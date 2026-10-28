"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Role } from "@/types/role";
import { cn } from "@/lib/utils";
import { getBottomNav, isHrefActive, roleHome } from "./nav-config";
import { useChatUnread } from "@/components/chat/chat-unread-provider";

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
  const router = useRouter();
  const home = roleHome(role);
  const items = getBottomNav(role);
  const { totalUnread } = useChatUnread();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-[#1e2128] dark:bg-[#141720]/95">
      <div className="flex items-stretch">
        {items.map((item) => {
          const active = isHrefActive(pathname, item.href, home);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onMouseEnter={() => router.prefetch(item.href)}
              onFocus={() => router.prefetch(item.href)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2.5 transition-colors duration-200",
                active
                  ? variant === "violet"
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-[var(--primary)]"
                  : "text-neutral-400 active:text-neutral-600 dark:text-neutral-500 dark:active:text-neutral-300"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-3 top-0 h-[2px] origin-center rounded-full transition-all duration-300 ease-out motion-reduce:transition-none",
                  active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
                  variant === "violet" ? "bg-violet-600 dark:bg-violet-400" : "bg-[var(--primary)]"
                )}
              />
              <span className="relative">
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
                    active && "-translate-y-px",
                    active
                      ? variant === "violet"
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-[var(--primary)]"
                      : "text-neutral-400 dark:text-neutral-500"
                  )}
                />
                {item.href === "/messages" && totalUnread > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--primary)] px-0.5 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#141720]">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
