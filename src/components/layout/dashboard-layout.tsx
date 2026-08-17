"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import Header from "./header";
import BottomNav from "./bottom-nav";
import { NavModeProvider, useNavMode } from "@/components/nav-mode-provider";
import SessionGuard from "@/components/session-guard";
import { ToastProvider } from "@/components/ui/toast";
import BackButton from "@/components/ui/back-button";
import { Role } from "@prisma/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: Role;
    centerId?: string;
    frozen?: boolean;
  };
  centerName?: string;
  centerLogo?: string | null;
  frozen?: boolean;
}

export default function DashboardLayoutClient(props: DashboardLayoutProps) {
  return (
    <NavModeProvider>
      <DashboardShell {...props} />
    </NavModeProvider>
  );
}

function DashboardShell({ children, user, centerName, centerLogo, frozen }: DashboardLayoutProps) {
  const { navMode } = useNavMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [frozenState, setFrozenState] = useState(!!frozen);
  const pathname = usePathname();

  const roleHome =
    user.role === "admin"
      ? "/admin"
      : user.role === "eleve"
        ? "/eleve"
        : user.role === "super_admin"
          ? "/super-admin"
          : "/prof";

  const showBackButton = pathname !== roleHome;

  useEffect(() => {
    if (!user.centerId) return;
    const interval = setInterval(async () => {
      try {
        const sessRes = await fetch("/api/auth/session");
        const sess = await sessRes.json();
        if (sess?.user?.id !== user.id) return;
        if (typeof sess?.user?.frozen === "boolean") {
          setFrozenState(sess.user.frozen);
        }
      } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, [user.centerId, user.id]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1114]">
      <SessionGuard />
      <Sidebar
        role={user.role}
        centerName={centerName}
        centerLogo={centerLogo}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="md:pl-64">
        <Header
          centerLogo={centerLogo}
          onMenuToggle={navMode === "sidebar" ? () => setSidebarOpen(!sidebarOpen) : undefined}
        />
        {frozenState && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-[13px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Compte gelé : aucune modification autorisée
            <span className="hidden sm:inline">— vous pouvez uniquement consulter vos informations</span>
          </div>
        )}
        <main className={`p-4 sm:p-5 lg:p-6 ${navMode === "bottom" ? "pb-28" : ""} ${frozenState ? "frozen-mode" : ""}`}>
          {showBackButton && (
            <div className="mb-3">
              <BackButton fallbackHref={roleHome} />
            </div>
          )}
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>

      {navMode === "bottom" && <BottomNav role={user.role} />}
    </div>
  );
}
