"use client";

import { useState } from "react";
import SuperAdminSidebar from "@/components/layout/super-admin-sidebar";
import SuperAdminHeader from "@/components/layout/super-admin-header";
import BottomNav from "@/components/layout/bottom-nav";
import SessionGuard from "@/components/session-guard";
import { Role } from "@prisma/client";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1114]">
      <SessionGuard />
      <SuperAdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:pl-64">
        <SuperAdminHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 sm:p-5 lg:p-6 pb-28 md:pb-6">{children}</main>
      </div>
      <BottomNav role={"super_admin" as Role} variant="violet" />
    </div>
  );
}
