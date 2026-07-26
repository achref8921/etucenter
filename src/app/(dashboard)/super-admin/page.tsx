import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import {
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const sa = session?.user as any;

  const [
    totalCenters,
    activeCenters,
    totalUsers,
    totalAdmins,
    totalTeachers,
    totalStudents,
    totalGroups,
    totalMatieres,
    recentLogs,
    recentCenters,
  ] = await Promise.all([
    prisma.center.count(),
    prisma.center.count({ where: { active: true } }),
    prisma.utilisateur.count({ where: { role: { not: "super_admin" } } }),
    prisma.utilisateur.count({ where: { role: "admin" } }),
    prisma.utilisateur.count({ where: { role: "prof" } }),
    prisma.utilisateur.count({ where: { role: "eleve" } }),
    prisma.groupe.count(),
    prisma.matiere.count(),
    prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.center.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { utilisateurs: true, groupes: true } } },
    }),
  ]);

  const inactiveCenters = totalCenters - activeCenters;

  const statCards = [
    { label: "Total Centers", value: totalCenters, icon: Building2, color: "bg-violet-500", shadow: "shadow-violet-200 dark:shadow-violet-900/30", sub: `${activeCenters} active, ${inactiveCenters} inactive` },
    { label: "Total Users", value: totalUsers, icon: Users, color: "bg-blue-500", shadow: "shadow-blue-200 dark:shadow-blue-900/30", sub: `${totalAdmins} admins, ${totalTeachers} teachers, ${totalStudents} students` },
    { label: "Groups", value: totalGroups, icon: GraduationCap, color: "bg-emerald-500", shadow: "shadow-emerald-200 dark:shadow-emerald-900/30", sub: "Across all centers" },
    { label: "Subjects", value: totalMatieres, icon: BookOpen, color: "bg-amber-500", shadow: "shadow-amber-200 dark:shadow-amber-900/30", sub: "Across all centers" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Platform Overview</h1>
        <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">EduCenter SaaS — Global metrics and insights</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow dark:border-slate-700 dark:bg-slate-900 dark:hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{card.sub}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color} shadow-md ${card.shadow}`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Centers</h2>
            <Link href="/super-admin/centers" className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {recentCenters.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.slug} · {c._count.utilisateurs} users · {c._count.groupes} groups</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                  {c.active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
            {recentCenters.length === 0 && (
              <p className="px-5 py-4 text-sm text-slate-400 dark:text-slate-500">No centers yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
            <Link href="/super-admin/logs" className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <AlertTriangle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate dark:text-slate-100">{log.action}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <p className="px-5 py-4 text-sm text-slate-400 dark:text-slate-500">No activity logs yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
