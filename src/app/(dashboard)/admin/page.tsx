import Link from "next/link";
import { Suspense } from "react";
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Users,
  GraduationCap,
  Banknote,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { getAdminDashboardMonthData } from "@/lib/admin-dashboard-data";
import { MonthSelector } from "@/components/month-selector";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function DashboardContent({ month }: { month: string }) {
  const session = await getServerSession(authOptions);
  const centerId = (session?.user as any)?.centerId;
  const data = await getAdminDashboardMonthData(centerId, month);

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-[#2a2d35] dark:bg-[#181b22]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Bénéfice Net du Centre
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatCurrency(data.netCenterEarnings)}
            </p>
            <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
              20% de {formatCurrency(data.netPaidSessionsRevenue)} — Revenu brut
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
            <Banknote className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-neutral-100 pt-4 dark:border-[#2a2d35]">
          <div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">Revenu Brut</p>
            <p className="text-[13px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {formatCurrency(data.netPaidSessionsRevenue)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">Impayés</p>
            <p className="text-[13px] font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(data.totalUnpaid)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">Bénéfice Centre</p>
            <p className="text-[13px] font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatCurrency(data.netCenterEarnings)}
            </p>
          </div>
        </div>
        <Link
          href={`/admin/benefices?month=${month}`}
          className="mt-4 flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
        >
          Voir les bénéfices détaillés <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Impayés Total
            </p>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {formatCurrency(data.totalUnpaid)}
          </p>
          <Link
            href="/admin/finances"
            className="mt-2 flex items-center gap-1 text-[12px] font-medium text-red-600 opacity-0 transition-opacity hover:opacity-100 dark:text-red-400"
          >
            Gerer <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Effectifs
            </p>
            <Users className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          </div>
          <div className="mt-2 flex items-center gap-4">
            <div>
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{data.totalStudents}</span>
              <span className="ml-1 text-[12px] text-neutral-400 dark:text-neutral-500">eleves</span>
            </div>
            <div className="h-4 w-px bg-neutral-200 dark:bg-[#2a2d35]"></div>
            <div>
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{data.totalTeachers}</span>
              <span className="ml-1 text-[12px] text-neutral-400 dark:text-neutral-500">profs</span>
            </div>
          </div>
        </div>
      </div>

      {data.profs.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-[#2a2d35]">
            <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
              Bénéfices par professeur
            </h2>
            <Link
              href="/admin/finances-professeurs"
              className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Comptes profs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-[#2a2d35]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Prof
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Taux
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Reçu
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Centre
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Salaire
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
                {data.profs.map((p) => (
                  <tr
                    key={p.prof.id}
                    className="transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                  >
                    <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">
                      {p.prof.prenom} {p.prof.nom}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                        {p.taux}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(p.netRevenue)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-medium text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(p.beneficeCentre)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-medium text-purple-600 dark:text-purple-400">
                      {formatCurrency(p.salaireProf)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-50 font-semibold dark:bg-[#1e2128]">
                  <td className="px-4 py-2.5 text-neutral-900 dark:text-neutral-100">Total</td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(data.netPaidSessionsRevenue)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(data.netCenterEarnings)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-purple-600 dark:text-purple-400">
                    {formatCurrency(data.netPaidSessionsRevenue - data.netCenterEarnings)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = params.month || getCurrentMonth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Tableau de bord
        </h1>
        <Suspense fallback={null}>
          <MonthSelector month={month} />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-neutral-200 bg-white dark:border-[#2a2d35] dark:bg-[#181b22]"
              />
            ))}
          </div>
        }
      >
        <DashboardContent month={month} />
      </Suspense>
    </div>
  );
}
