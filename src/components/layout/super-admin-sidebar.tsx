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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform duration-300 ease-in-out dark:border-[#1e2128] dark:bg-[#141720]",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b border-neutral-100 px-5 dark:border-[#1e2128]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Étudnet</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-violet-500 dark:text-violet-400">
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
                accent="violet"
                storageKey={`nav-open:super_admin:${section.key}`}
                onNavigate={onClose}
              />
            ) : (
              <NavLeafLink
                key={section.href}
                item={section}
                home={home}
                accent="violet"
                onNavigate={onClose}
              />
            )
          )}
        </nav>

        <div className="border-t border-neutral-100 px-5 py-3 dark:border-[#1e2128]">
            <p className="text-[10px] text-neutral-300 dark:text-neutral-600">Étudnet Platform v1.0</p>
        </div>
      </aside>
    </>
  );
}
