import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/ui";
import type { StudentOverGroupPrice } from "@/lib/students-over-group-price";

export function StudentsOverGroupPriceList({
  items,
  role = "admin",
}: {
  items: StudentOverGroupPrice[];
  role?: "admin" | "prof";
}) {
  const totalImpaye = items.reduce((sum, item) => sum + item.impaye, 0);

  return (
    <Card className="animate-fade-in-up overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <CardTitle>Impayé supérieur au prix du groupe</CardTitle>
            <p className="text-[var(--text-label)] text-[var(--foreground-faint)]">
              Élèves devant plus que le prix d&apos;une séance, quel que soit le
              nombre de séances restantes.
            </p>
          </div>
          <Badge variant="error">{items.length}</Badge>
        </div>
        {items.length > 0 && (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-[var(--foreground-faint)]">
              Total impayé
            </p>
            <p className="text-[15px] font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(totalImpaye)}
            </p>
          </div>
        )}
      </CardHeader>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="text-[13px] font-medium text-[var(--foreground)]">
            Aucun élève concerné
          </p>
          <p className="text-[12px] text-[var(--foreground-faint)]">
            Tous les impayés restent inférieurs ou égaux au prix d&apos;une séance.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Élève</TH>
                <TH>Groupe</TH>
                {role === "admin" && <TH>Professeur</TH>}
                <TH className="text-right">Prix séance</TH>
                <TH className="text-right">Total dû</TH>
                <TH className="text-right">Payé</TH>
                <TH className="text-right">Impayé</TH>
                <TH className="text-right">Dépassement</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((item) => {
                const href =
                  role === "admin"
                    ? `/admin/eleves/${item.eleveId}`
                    : `/prof/eleves/${item.eleveId}`;
                return (
                  <TR key={`${item.eleveId}-${item.groupeId}`} className="group">
                    <TD>
                      <Link
                        href={href}
                        prefetch={false}
                        className="font-medium text-[var(--foreground)] transition-colors hover:text-[var(--primary)] hover:underline"
                      >
                        {item.elevePrenom} {item.eleveNom}
                      </Link>
                      <p className="text-[11px] tabular-nums text-[var(--foreground-faint)]">
                        {item.eleveCode ?? "—"}
                        {item.eleveClasse ? ` · ${item.eleveClasse}` : ""}
                      </p>
                    </TD>
                    <TD>
                      <p className="font-medium text-[var(--foreground)]">{item.groupeNom}</p>
                      {item.matiereNom && (
                        <p className="text-[11px] text-[var(--foreground-faint)]">
                          {item.matiereNom}
                        </p>
                      )}
                    </TD>
                    {role === "admin" && (
                      <TD className="text-[var(--foreground-faint)]">
                        {item.profNom ? `${item.profPrenom} ${item.profNom}` : "—"}
                      </TD>
                    )}
                    <TD className="text-right tabular-nums text-[var(--foreground-faint)]">
                      {formatCurrency(item.prixSeance)}
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(item.totalDue)}</TD>
                    <TD className="text-right tabular-nums text-[var(--foreground-faint)]">
                      {formatCurrency(item.totalPaid)}
                    </TD>
                    <TD className="text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                      {formatCurrency(item.impaye)}
                    </TD>
                    <TD className="text-right">
                      <Badge variant="warning">+{formatCurrency(item.excedent)}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={href}
                        prefetch={false}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--primary)] hover:underline"
                      >
                        Voir
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
