"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import SuperAdminSidebar from "@/components/layout/super-admin-sidebar";
import SuperAdminHeader from "@/components/layout/super-admin-header";
import BottomNav from "@/components/layout/bottom-nav";
import SessionGuard from "@/components/session-guard";
import UsageTracker from "@/components/usage-tracker";
import RouteTransition from "@/components/layout/route-transition";
import { Role } from "@prisma/client";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SessionGuard />
      <RouteTransition />
      <Suspense fallback={null}>
        <UsageTracker />
      </Suspense>
      <SuperAdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:pl-64">
        <SuperAdminHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 sm:p-5 lg:p-6 pb-28 md:pb-6">
          <div key={pathname} className="animate-fade-in-up motion-reduce:animate-none">
            {children}
          </div>
        </main>
      </div>
      <BottomNav role={"super_admin" as Role} variant="blue" />
    </div>
  );
}
