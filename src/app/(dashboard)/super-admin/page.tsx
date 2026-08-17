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
    { label: "Total Centers", value: totalCenters, icon: Building2, iconColor: "text-violet-500 dark:text-violet-400", sub: `${activeCenters} actifs, ${inactiveCenters} inactifs` },
    { label: "Total Utilisateurs", value: totalUsers, icon: Users, iconColor: "text-blue-500 dark:text-blue-400", sub: `${totalAdmins} admins, ${totalTeachers} profs, ${totalStudents} élèves` },
    { label: "Groupes", value: totalGroups, icon: GraduationCap, iconColor: "text-emerald-500 dark:text-emerald-400", sub: "Tous centres confondus" },
    { label: "Matières", value: totalMatieres, icon: BookOpen, iconColor: "text-amber-500 dark:text-amber-400", sub: "Tous centres confondus" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Aperçu de la plateforme</h1>
        <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">EduCenter SaaS — Métriques globales et insights</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50 dark:border-[#2a2d35] dark:bg-[#181b22] dark:hover:bg-[#1e2128]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">{card.value}</p>
                <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">{card.sub}</p>
              </div>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-[#2a2d35]">
            <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Centers récents</h2>
            <Link href="/super-admin/centers" className="text-[12px] font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {recentCenters.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50/50 dark:hover:bg-[#1e2128]/50">
                <div>
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">{c.name}</p>
                  <p className="text-[12px] text-neutral-400 dark:text-neutral-500">{c.slug} · {c._count.utilisateurs} users · {c._count.groupes} groupes</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                  {c.active ? "Actif" : "Inactif"}
                </span>
              </div>
            ))}
            {recentCenters.length === 0 && (
              <p className="px-4 py-3 text-center text-[13px] text-neutral-400 dark:text-neutral-500">Aucun centre pour le moment.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-[#2a2d35]">
            <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Activité récente</h2>
            <Link href="/super-admin/logs" className="text-[12px] font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50/50 dark:hover:bg-[#1e2128]/50">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-neutral-900 truncate dark:text-neutral-100">{log.action}</p>
                  <p className="text-[12px] text-neutral-400 dark:text-neutral-500">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <p className="px-4 py-3 text-center text-[13px] text-neutral-400 dark:text-neutral-500">Aucun journal d&apos;activité.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
