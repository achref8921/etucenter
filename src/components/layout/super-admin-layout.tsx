"use client";

import { useState } from "react";
import SuperAdminSidebar from "@/components/layout/super-admin-sidebar";
import SuperAdminHeader from "@/components/layout/super-admin-header";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <SuperAdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:pl-64">
        <SuperAdminHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
