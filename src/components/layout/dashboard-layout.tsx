"use client";

import { useState } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import { Role } from "@prisma/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: Role;
  };
  centerName?: string;
  centerLogo?: string | null;
}

export default function DashboardLayoutClient({ children, user, centerName, centerLogo }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
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
