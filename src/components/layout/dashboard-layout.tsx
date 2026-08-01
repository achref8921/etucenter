"use client";

import { useEffect, useState } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import SessionWatcher from "@/components/session-watcher";
import SessionGuard from "@/components/session-guard";
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

export default function DashboardLayoutClient({ children, user, centerName, centerLogo, frozen }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [frozenState, setFrozenState] = useState(!!frozen);

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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <SessionGuard />
      <SessionWatcher />
      <Sidebar
        role={user.role}
        centerName={centerName}
        centerLogo={centerLogo}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="md:pl-64">
        <Header centerLogo={centerLogo} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        {frozenState && (
          <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2.5 text-center text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            الحساب مجمد لا يستطيع التعديل عليه
            <span className="hidden sm:inline">— يمكنك فقط مشاهدة معلوماتك</span>
          </div>
        )}
        <main className={`p-4 sm:p-6 ${frozenState ? "frozen-mode" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
