import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Users,
  Banknote,
  CalendarDays,
  Clock,
  UserRound,
  CheckCircle2,
  Circle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import {
  getAdminDashboardMonthData,
  getAdminTodaySeances,
  getReversePendingCenterParts,
} from "@/lib/admin-dashboard-data";
import { MonthSelector } from "@/components/month-selector";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  EmptyState,
  Badge,
  Table,
  THead,
  TH,
  TR,
  TD,
  MetricCard,
  BarChart,
  Avatar,
} from "@/components/ui";

const SEANCE_STATUT_LABEL: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function StatutBadge({ statut }: { statut: string }) {
  const variant =
    statut === "terminee"
      ? "success"
      : statut === "en_cours"
        ? "info"
        : statut === "annulee"
          ? "error"
          : "neutral";
  return (
    <Badge variant={variant}>
      {statut === "terminee" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Circle className={statut === "en_cours" ? "h-3 w-3 animate-pulse" : "h-3 w-3"} />
      )}
      {SEANCE_STATUT_LABEL[statut] || statut}
    </Badge>
  );
}

function CardPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

async function DashboardContent({ month }: { month: string }) {
  const session = await getServerSession(authOptions);
  const centerId = (session?.user as any)?.centerId;
  const data = await getAdminDashboardMonthData(centerId, month);
  const todaySeances = await getAdminTodaySeances(centerId);
  const pendingParts = await getReversePendingCenterParts(centerId);
  const pendingPartsBalance = pendingParts.reduce((sum, p) => sum + p.balance, 0);

  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const revenue = data.netPaidSessionsRevenue;
  const centerShare =
    revenue > 0 ? Math.round((data.totalCenterBenefit / revenue) * 100) : 0;

  const profsSorted = [...data.profs].sort((a, b) => b.netRevenue - a.netRevenue);
  const activeProfs = profsSorted.filter((p) => p.netRevenue > 0);
  const chartData = profsSorted.slice(0, 8).map((p) => ({
    label: `${p.prof.prenom} ${p.prof.nom}`.trim(),
    value: p.netRevenue,
  }));

  const benefitSpark = profsSorted
    .map((p) => Math.max(0, p.beneficeCentre + (p.reverseSettledRevenue ?? 0)))
    .slice(0, 8);
  const revenueSpark = profsSorted.map((p) => Math.max(0, p.netRevenue)).slice(0, 8);
  const elevesSpark = profsSorted.map((p) => p.nombreEleves).slice(0, 8);
  const unpaidRatio =
    revenue > 0 ? Math.round((data.totalUnpaid / revenue) * 100) : 0;

  return (
    <>
      {/* Bandeau KPI */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 right-1/3 h-40 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-500/20"
        />
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
            <MetricCard
              className="h-full"
              label="Bénéfice Net du Centre"
              value={data.totalCenterBenefit}
              sub={`${centerShare}% de ${formatCurrency(revenue)}`}
              icon={Banknote}
              tone="primary"
              ring={centerShare}
              spark={benefitSpark}
              href={`/admin/benefices?month=${month}`}
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
            <MetricCard
              className="h-full"
              label="Revenu Brut"
              value={revenue}
              sub={`${activeProfs.length} professeur${activeProfs.length > 1 ? "s" : ""} actif${activeProfs.length > 1 ? "s" : ""}`}
              icon={TrendingUp}
              tone="success"
              spark={revenueSpark}
              href="/admin/finances"
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
            <MetricCard
              className="h-full"
              label="Impayés"
              value={data.totalUnpaid}
              sub={data.totalUnpaid > 0 ? "à recouvrer" : "aucun impayé"}
              icon={AlertTriangle}
              tone="error"
              trend={data.totalUnpaid > 0 ? "down" : undefined}
              ring={unpaidRatio}
              href="/admin/impayes"
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: "240ms" }}>
            <MetricCard
              className="h-full"
              label="Effectifs"
              value={data.totalStudents}
              currency={false}
              sub={`${data.totalTeachers} professeur${data.totalTeachers > 1 ? "s" : ""}`}
              icon={Users}
              tone="warning"
              spark={elevesSpark}
              href="/admin/utilisateurs"
            />
          </div>
        </div>
      </div>

      {/* Revenus par professeur + Activité du jour */}
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-3 animate-fade-in-up"
        style={{ animationDelay: "320ms" }}
      >
        <CardPanel className="p-5 lg:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
                Revenus par professeur
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--foreground-faint)]">
                Encaissements du mois par professeur
              </p>
            </div>
            <Link
              href="/admin/finances-professeurs"
              prefetch={false}
              className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--primary)] hover:underline"
            >
              Détail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Aucun encaissement ce mois"
              description="Les revenus apparaîtront ici dès le premier paiement enregistré."
            />
          ) : (
            <BarChart data={chartData} format="currency" height={190} />
          )}
        </CardPanel>

        <CardPanel className="flex flex-col p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
                Activité du jour
              </h3>
              <p className="mt-0.5 text-[12px] capitalize text-[var(--foreground-faint)]">
                {todayLabel}
              </p>
            </div>
            <Badge variant="primary">{todaySeances.length}</Badge>
          </div>

          {todaySeances.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground-faint)]">
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="text-[13px] font-medium text-[var(--foreground)]">Aucune séance</p>
              <p className="mt-0.5 text-[12px] text-[var(--foreground-faint)]">
                Rien de planifié aujourd&apos;hui
              </p>
            </div>
          ) : (
            <ul className="-mx-1 space-y-1">
              {todaySeances.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/groupes/${s.groupe.id}`}
                    prefetch={false}
                    title="Voir le groupe"
                    className="flex items-center gap-3 rounded-[12px] px-1 py-2 transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--foreground)]">
                        {s.groupe.nom}
                      </p>
                      <p className="truncate text-[11.5px] text-[var(--foreground-faint)]">
                        {formatTime(s.heureDebut)}
                        {s.heureFin ? `–${formatTime(s.heureFin)}` : ""}
                        {s.prof ? ` · ${s.prof.prenom} ${s.prof.nom}` : ""}
                      </p>
                    </div>
                    <StatutBadge statut={s.statut} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardPanel>
      </div>

      {/* Parts centre en cours */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <DollarSign className="h-4 w-4" />
            </span>
            <CardTitle>Parts centre en cours (non réglées)</CardTitle>
            <Badge variant="warning">{formatCurrency(pendingPartsBalance)}</Badge>
          </div>
          <Link
            href={`/admin/benefices?month=${month}`}
            prefetch={false}
            className="flex items-center gap-1 text-[var(--text-label)] font-medium text-[var(--primary)] hover:underline"
          >
            Voir le détail <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        {pendingParts.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={DollarSign}
              title="Aucune part centre en cours"
              description="Les parts dues par les professeurs apparaîtront ici une fois des encaissements enregistrés."
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Professeur</TH>
                  <TH>Dettes</TH>
                  <TH className="text-right">Montant en cours</TH>
                </TR>
              </THead>
              <tbody className="divide-y divide-[var(--border)]">
                {pendingParts.map((p) => {
                  const href = `/admin/finances-professeurs?teacherId=${p.prof.id}`;
                  return (
                    <TR key={p.prof.id} className="group cursor-pointer">
                      <TD className="relative font-medium">
                        <Link
                          href={href}
                          prefetch={false}
                          aria-label={`Voir le compte de ${p.prof.prenom} ${p.prof.nom}`}
                          className="absolute inset-0 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
                        />
                        <span className="relative flex items-center gap-2">
                          {p.prof.prenom} {p.prof.nom}
                          <ArrowRight className="h-3.5 w-3.5 text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </TD>
                      <TD className="relative tabular-nums text-[var(--foreground-faint)]">
                        <Link href={href} prefetch={false} tabIndex={-1} aria-hidden="true" className="absolute inset-0" />
                        <span className="relative">{p.debts.length}</span>
                      </TD>
                      <TD className="relative text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        <Link href={href} prefetch={false} tabIndex={-1} aria-hidden="true" className="absolute inset-0" />
                        <span className="relative">{formatCurrency(p.balance)}</span>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* Équipe pédagogique */}
      <CardPanel className="animate-fade-in-up p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
              Équipe pédagogique
            </h3>
            <p className="mt-0.5 text-[12px] text-[var(--foreground-faint)]">
              {data.totalTeachers} professeur{data.totalTeachers > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/admin/utilisateurs"
            prefetch={false}
            className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--primary)] hover:underline"
          >
            Gérer <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {data.profs.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun professeur"
            description="Ajoutez des professeurs pour les voir apparaître ici."
          />
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {profsSorted.slice(0, 10).map((p) => (
              <li key={p.prof.id} className="border-b border-[var(--border)]">
                <Link
                  href={`/admin/professeurs/${p.prof.id}`}
                  prefetch={false}
                  title="Voir la fiche du professeur"
                  className="flex items-center gap-3 rounded-[12px] px-1 py-2.5 transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <Avatar name={`${p.prof.prenom} ${p.prof.nom}`} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--foreground)]">
                      {p.prof.prenom} {p.prof.nom}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--foreground-faint)]">
                      {p.nombreEleves} élève{p.nombreEleves > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--foreground-faint)]">
                    {p.taux}%
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-faint)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardPanel>

      {/* Détail financier par professeur */}
      {data.profs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Détail financier par professeur</CardTitle>
            <Link
              href="/admin/finances-professeurs"
              prefetch={false}
              className="flex items-center gap-1 text-[var(--text-label)] font-medium text-[var(--primary)] hover:underline"
            >
              Comptes profs <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Prof</TH>
                  <TH>Taux</TH>
                  <TH>Reçu</TH>
                  <TH>Centre</TH>
                  <TH>Salaire</TH>
                  <TH>À encaisser</TH>
                </TR>
              </THead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.profs.map((p) => (
                  <TR key={p.prof.id}>
                    <TD className="font-medium">
                      <Link
                        href={`/admin/professeurs/${p.prof.id}`}
                        prefetch={false}
                        className="transition-colors hover:text-[var(--primary)] hover:underline"
                      >
                        {p.prof.prenom} {p.prof.nom}
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant="primary">{p.taux}%</Badge>
                    </TD>
                    <TD className="tabular-nums">{formatCurrency(p.netRevenue)}</TD>
                    <TD className="tabular-nums font-medium text-[var(--primary)]">
                      {formatCurrency(p.beneficeCentre + (p.reverseSettledRevenue ?? 0))}
                    </TD>
                    <TD className="tabular-nums font-medium text-purple-600 dark:text-purple-400">
                      {formatCurrency(p.salaireProf)}
                    </TD>
                    <TD className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.claimable)}
                    </TD>
                  </TR>
                ))}
                <TR className="bg-[var(--surface-muted)] font-semibold hover:bg-[var(--surface-muted)]">
                  <TD>Total</TD>
                  <TD />
                  <TD className="tabular-nums">{formatCurrency(revenue)}</TD>
                  <TD className="tabular-nums text-[var(--primary)]">
                    {formatCurrency(data.totalCenterBenefit)}
                  </TD>
                  <TD className="tabular-nums text-purple-600 dark:text-purple-400">
                    {formatCurrency(revenue - data.netCenterEarnings)}
                  </TD>
                  <TD className="tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(data.profs.reduce((sum, p) => sum + p.claimable, 0))}
                  </TD>
                </TR>
              </tbody>
            </Table>
          </div>
        </Card>
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
    <div className="space-y-[var(--space-section-y)]">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de l'activité et des finances du centre"
        actions={
          <Suspense fallback={null}>
            <MonthSelector month={month} />
          </Suspense>
        }
      />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-[20px] border border-[var(--border)] bg-[var(--surface)]"
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
