"use client";

import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavSections, isNavGroup } from "./nav-config";
import { NavGroupSection, NavLeafLink } from "./nav-group";

interface SuperAdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function SuperAdminSidebar({ open, onClose }: SuperAdminSidebarProps) {
  const home = "/super-admin";
  const sections = getNavSections("super_admin");

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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-200 bg-white/80 backdrop-blur-md transition-transform duration-300 ease-in-out dark:border-[#1e2128] dark:bg-[#141720]/85",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-neutral-200 px-5 dark:border-[#1e2128]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-blue-600 shadow-xs">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Étudnet</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-blue-500 dark:text-blue-400">
              Super Admin
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3 overflow-y-auto">
          {sections.map((section) =>
            isNavGroup(section) ? (
              <NavGroupSection
                key={section.key}
                group={section}
                home={home}
                accent="blue"
                storageKey={`nav-open:super_admin:${section.key}`}
                onNavigate={onClose}
              />
            ) : (
              <NavLeafLink
                key={section.href}
                item={section}
                home={home}
                accent="blue"
                onNavigate={onClose}
              />
            )
          )}
        </nav>

        <div className="border-t border-neutral-200 px-5 py-3 dark:border-[#1e2128]">
            <p className="text-[10px] font-medium text-neutral-300 dark:text-neutral-600">Étudnet <span className="text-neutral-400 dark:text-neutral-500">Platform v1.0</span></p>
        </div>
      </aside>
    </>
  );
}
