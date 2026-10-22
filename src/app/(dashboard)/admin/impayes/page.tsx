import Link from "next/link";
import { AlertTriangle, ArrowRight, Layers, Users } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnpaidStudents } from "@/lib/admin-dashboard-data";
import { formatCurrency } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  MetricCard,
  PageHeader,
  Table,
  THead,
  TH,
  TR,
  TD,
} from "@/components/ui";

export default async function AdminUnpaidPage() {
  const session = await getServerSession(authOptions);
  const centerId = (session?.user as any)?.centerId;
  const students = await getUnpaidStudents(centerId);

  const totalUnpaid = students.reduce((sum, s) => sum + s.totalUnpaid, 0);
  const groupsCount = new Set(students.flatMap((s) => s.groups.map((g) => g.id))).size;

  return (
    <div className="space-y-[var(--space-section-y)]">
      <PageHeader
        title="Impayés"
        subtitle="Élèves avec un solde de séances non réglé, calculé à partir des présences et des paiements enregistrés"
        actions={
          <Link
            href="/admin/finances"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-xs transition-[filter] hover:brightness-[0.94]"
          >
            Encaissements <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <MetricCard
            className="h-full"
            label="Total impayé"
            value={totalUnpaid}
            sub={`${students.length} élève${students.length > 1 ? "s" : ""} concerné${students.length > 1 ? "s" : ""}`}
            icon={AlertTriangle}
            tone="error"
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          <MetricCard
            className="h-full"
            label="Élèves concernés"
            value={students.length}
            currency={false}
            sub="sur l'ensemble du centre"
            icon={Users}
            tone="warning"
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <MetricCard
            className="h-full"
            label="Groupes concernés"
            value={groupsCount}
            currency={false}
            sub="toutes séances confondues"
            icon={Layers}
            tone="neutral"
          />
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
              Détail par élève
            </h2>
            <Badge variant="error">{students.length}</Badge>
          </div>
          <p className="text-[12px] text-[var(--foreground-faint)]">
            Cliquez sur un groupe pour consulter son détail
          </p>
        </div>

        {students.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={AlertTriangle}
              title="Aucun impayé"
              description="Tous les élèves sont à jour de leurs paiements."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Élève</TH>
                  <TH>Classe</TH>
                  <TH>Groupes concernés</TH>
                  <TH className="text-right">Montant dû</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody className="divide-y divide-[var(--border)]">
                {students.map((s) => (
                  <TR key={s.student.id}>
                    <TD>
                      <Link
                        href={`/admin/eleves/${s.student.id}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar name={`${s.student.prenom} ${s.student.nom}`} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-[var(--foreground)] transition-colors hover:text-[var(--primary)]">
                            {s.student.prenom} {s.student.nom}
                          </span>
                          <span className="block text-[11px] text-[var(--foreground-faint)]">
                            {s.student.codeEleve ? `Code ${s.student.codeEleve}` : "Sans code"}
                          </span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-[var(--foreground-faint)]">
                      {s.student.classe || "—"}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        {s.groups.map((g) => (
                          <Link
                            key={g.id}
                            href={`/admin/groupes/${g.id}`}
                            title={`${g.nom} · ${formatCurrency(g.unpaid)}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground-subtle)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                          >
                            <span className="max-w-[140px] truncate">{g.nom}</span>
                            <span className="tabular-nums text-[var(--foreground-faint)]">
                              {formatCurrency(g.unpaid)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </TD>
                    <TD className="text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatCurrency(s.totalUnpaid)}
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/eleves/${s.student.id}`}
                          className="inline-flex h-8 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12px] font-semibold text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                        >
                          Fiche
                        </Link>
                        <Link
                          href={`/admin/finances?studentId=${s.student.id}`}
                          className="inline-flex h-8 items-center rounded-[8px] bg-[var(--primary)] px-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] transition-[filter] hover:brightness-[0.94]"
                        >
                          Encaisser
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
