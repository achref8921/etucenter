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
import { MetricCard } from "@/components/ui";


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

  const statCards: {
    label: string;
    value: number;
    icon: typeof Building2;
    tone: "primary" | "success" | "warning" | "neutral";
    sub: string;
  }[] = [
    { label: "Centres", value: totalCenters, icon: Building2, tone: "primary", sub: `${activeCenters} actifs, ${inactiveCenters} inactifs` },
    { label: "Utilisateurs", value: totalUsers, icon: Users, tone: "neutral", sub: `${totalAdmins} admins, ${totalTeachers} profs, ${totalStudents} élèves` },
    { label: "Groupes", value: totalGroups, icon: GraduationCap, tone: "success", sub: "Tous centres confondus" },
    { label: "Matières", value: totalMatieres, icon: BookOpen, tone: "warning", sub: "Tous centres confondus" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Aperçu de la plateforme</h1>
        <p className="mt-1 text-[13px] text-[var(--foreground-faint)]">Étudnet SaaS — Métriques globales et insights</p>
      </div>

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up"
        style={{ animationDelay: "60ms" }}
      >
        {statCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            currency={false}
            sub={card.sub}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Centers récents</h2>
            <Link href="/super-admin/centers" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentCenters.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50/50 dark:hover:bg-[#1e2128]/50">
                <div>
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{c.name}</p>
                  <p className="text-[12px] text-[var(--foreground-faint)]">{c.slug} · {c._count.utilisateurs} users · {c._count.groupes} groupes</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                  {c.active ? "Actif" : "Inactif"}
                </span>
              </div>
            ))}
            {recentCenters.length === 0 && (
              <p className="px-4 py-3 text-center text-[13px] text-[var(--foreground-faint)]">Aucun centre pour le moment.</p>
            )}
          </div>
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Activité récente</h2>
            <Link href="/super-admin/logs" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50/50 dark:hover:bg-[#1e2128]/50">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[var(--foreground-faint)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-neutral-900 truncate dark:text-neutral-100">{log.action}</p>
                  <p className="text-[12px] text-[var(--foreground-faint)]">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <p className="px-4 py-3 text-center text-[13px] text-[var(--foreground-faint)]">Aucun journal d&apos;activité.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
