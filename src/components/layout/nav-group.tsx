"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isHrefActive, type NavGroup, type NavLeaf } from "./nav-config";

export type NavAccent = "blue" | "violet";

const accentStyles: Record<
  NavAccent,
  {
    activeLeaf: string;
    activeIcon: string;
    activeBar: string;
    headerActive: string;
    headerActiveBg: string;
    idle: string;
    guide: string;
  }
> = {
  blue: {
    activeLeaf: "bg-[var(--primary)]/10 text-[var(--primary)]",
    activeIcon: "text-[var(--primary)]",
    activeBar: "bg-[var(--primary)]",
    headerActive: "text-[var(--primary)]",
    headerActiveBg: "bg-[var(--primary)]/10",
    idle:
      "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200",
    guide: "border-neutral-300/80 dark:border-[#232732]",
  },
  violet: {
    activeLeaf: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    activeIcon: "text-violet-500 dark:text-violet-400",
    activeBar: "bg-violet-500 dark:bg-violet-400",
    headerActive: "text-violet-600 dark:text-violet-400",
    headerActiveBg: "bg-violet-50 dark:bg-violet-500/10",
    idle:
      "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200",
    guide: "border-neutral-300/80 dark:border-[#232732]",
  },
};

export function NavLeafLink({
  item,
  home,
  accent,
  nested = false,
  onNavigate,
}: {
  item: NavLeaf;
  home: string;
  accent: NavAccent;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const styles = accentStyles[accent];
  const pathname = usePathname();
  const active = isHrefActive(pathname, item.href, home);
  const Icon = item.icon as LucideIcon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors duration-200",
        nested ? "px-2.5 py-1.5" : "px-3 py-2",
        active ? styles.activeLeaf : styles.idle
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
          nested ? "-left-[7px] h-4 w-[3px] rounded-full" : "left-0 h-5 w-[3px] rounded-r-full",
          styles.activeBar,
          active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
        )}
      />
      <Icon
        className={cn(
          "flex-shrink-0 transition-colors",
          nested ? "h-4 w-4" : "h-[17px] w-[17px]",
          active
            ? styles.activeIcon
            : "text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function NavGroupSection({
  group,
  home,
  accent,
  storageKey,
  onNavigate,
}: {
  group: NavGroup;
  home: string;
  accent: NavAccent;
  storageKey: string;
  onNavigate?: () => void;
}) {
  const styles = accentStyles[accent];
  const pathname = usePathname();
  const active = group.items.some((item) => isHrefActive(pathname, item.href, home));
  const [open, setOpen] = useState(active);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => setContentHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (active) {
      setOpen(true);
      return;
    }
    try {
      if (localStorage.getItem(storageKey) === "1") setOpen(true);
    } catch {}
  }, [active, storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const bodyId = `nav-group-${group.key}`;
  const GroupIcon = group.icon as LucideIcon;

  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors duration-200",
          active ? cn(styles.headerActive, styles.headerActiveBg) : styles.idle
        )}
      >
        <GroupIcon
          className={cn(
            "h-[17px] w-[17px] flex-shrink-0 transition-colors",
            active
              ? styles.activeIcon
              : "text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300"
          )}
        />
        <span className="flex-1 truncate">{group.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-transform duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            open ? "rotate-180" : "rotate-0",
            active ? styles.activeIcon : "text-neutral-400 dark:text-neutral-600"
          )}
        />
      </button>

      <div
        id={bodyId}
        inert={!open}
        className="overflow-hidden transition-[height] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ height: open ? contentHeight : 0 }}
      >
        <div
          ref={contentRef}
          className={cn(
            "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            open ? "translate-y-0 opacity-100 delay-[40ms]" : "-translate-y-1 opacity-0"
          )}
        >
          <div className={cn("ml-[19px] space-y-0.5 border-l py-0.5 pl-1.5", styles.guide)}>
            {group.items.map((item) => (
              <NavLeafLink
                key={item.href}
                item={item}
                nested
                accent={accent}
                home={home}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
