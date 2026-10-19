"use client";

import { Role } from "@/types/role";
import { cn } from "@/lib/utils";
import {
  getNavSections,
  isNavGroup,
  roleHome as roleHomePath,
} from "./nav-config";
import { NavGroupSection, NavLeafLink } from "./nav-group";

export { navItemsByRole } from "./nav-config";

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
  peutGererEleves?: boolean;
  peutEncaisserReverse?: boolean;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ role, centerName, centerLogo, peutGererEleves, peutEncaisserReverse, open, onClose }: SidebarProps) {
  const home = roleHomePath(role);
  const sections = getNavSections(role, { peutGererEleves, peutEncaisserReverse });

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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:border-[#1e2128] dark:bg-[#141720]",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b border-neutral-200 px-5 dark:border-[#1e2128]">
          {centerLogo ? (
            <img src={centerLogo} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <img src="/logo.svg" alt="Logo" className="h-8 w-8 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{centerName || "Étudnet"}</span>
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {roleLabels[role]}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3 overflow-y-auto [scrollbar-gutter:stable] [overflow-anchor:none]">
          {sections.map((section) =>
            isNavGroup(section) ? (
              <NavGroupSection
                key={section.key}
                group={section}
                home={home}
                accent="blue"
                storageKey={`nav-open:${role}:${section.key}`}
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
          <p className="text-[10px] text-neutral-300 dark:text-neutral-600">Étudnet v1.0</p>
        </div>
      </aside>
    </>
  );
}
