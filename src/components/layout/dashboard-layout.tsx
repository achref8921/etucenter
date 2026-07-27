"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./sidebar";
import Header from "./header";
import SessionWatcher from "@/components/session-watcher";
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
  };
  centerName?: string;
  centerLogo?: string | null;
}

export default function DashboardLayoutClient({ children, user, centerName, centerLogo }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user.centerId) return;
    const interval = setInterval(async () => {
      try {
        const sessRes = await fetch("/api/auth/session");
        const sess = await sessRes.json();
        if (sess?.user?.id !== user.id) return;
        const res = await fetch("/api/admin/stats");
        if (res.status === 403) {
          const data = await res.json();
          if (data.suspended) {
            router.push("/centre-suspendu");
          }
        }
      } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, [user.centerId, user.id, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
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
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
