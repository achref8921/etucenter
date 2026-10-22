"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  DollarSign,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar,
  User,
  BookOpen,
  Wallet,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MetricCard } from "@/components/ui";
import type { SessionUser } from "@/types";

interface GroupeData {
  inscription: {
    id: string;
    dateInscription: string;
    statut: string;
  };
  groupe: {
    id: string;
    nom: string;
    description: string | null;
    prixParSeance: number;
    prof: { id: string; nom: string; prenom: string } | null;
    matiere: { id: string; nom: string } | null;
  };
  effectivePrixParSeance: number;
  stats: {
    totalDue: number;
    totalPaid: number;
    remainingCredit: number;
    unpaid: number;
  };
}

export default function EleveDashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const router = useRouter();
  const [groupes, setGroupes] = useState<GroupeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/eleve/groupes");
        if (!res.ok) throw new Error("Erreur lors du chargement des groupes");
        const data = await res.json();
        setGroupes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalRemaining = groupes.reduce((sum, g) => sum + g.stats.remainingCredit, 0);
  const totalDue = groupes.reduce((sum, g) => sum + g.stats.totalDue, 0);
  const totalPaid = groupes.reduce((sum, g) => sum + g.stats.totalPaid, 0);
  const totalUnpaid = groupes.reduce((sum, g) => sum + g.stats.unpaid, 0);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bonjour, {user?.prenom ?? "Élève"}
        </h1>
        <p className="text-[13px] text-[var(--foreground-faint)]">
          Cliquez sur une carte ou une ligne pour plus de détails.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-fade-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <MetricCard
          label="Mes groupes"
          value={groupes.length}
          currency={false}
          sub="inscrits"
          icon={GraduationCap}
          tone="primary"
        />
        <MetricCard
          label="Mon solde"
          value={totalRemaining}
          sub={totalRemaining < 0 ? "reste à payer" : "crédit disponible"}
          icon={Wallet}
          tone={totalRemaining < 0 ? "error" : "success"}
        />
        <MetricCard
          label="Total dû"
          value={totalDue}
          sub={totalUnpaid > 0 ? `${totalUnpaid} impayé(s)` : "à jour"}
          icon={Receipt}
          tone="warning"
        />
        <MetricCard
          label="Déjà payé"
          value={totalPaid}
          sub="cumul versé"
          icon={TrendingUp}
          tone="neutral"
        />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
          <h2 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Mes Groupes</h2>
          <Link
            href="/eleve/groupes"
            className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Groupe</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Matière</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Prof</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Prix/Séance</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {groupes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[var(--foreground-faint)]">
                    Vous n&apos;êtes inscrit à aucun groupe
                  </td>
                </tr>
              ) : (
                groupes.map((g) => {
                  const isExpanded = expandedId === g.groupe.id;
                  return (
                    <FragmentRow
                      key={g.groupe.id}
                      g={g}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : g.groupe.id)}
                      onOpen={() => router.push("/eleve/groupes")}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  g,
  isExpanded,
  onToggle,
  onOpen,
}: {
  g: GroupeData;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
      >
        <td className="px-4 py-2.5 text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline">{g.groupe.nom}</td>
        <td className="px-4 py-2.5 text-[13px] text-[var(--foreground-subtle)]">
          {g.groupe.matiere ? (
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
              {g.groupe.matiere.nom}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-2.5 text-[13px] text-[var(--foreground-subtle)]">
          {g.groupe.prof ? (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
              {g.groupe.prof.prenom} {g.groupe.prof.nom}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-2.5 text-[13px] tabular-nums text-[var(--foreground-subtle)]">{formatCurrency(g.effectivePrixParSeance)}</td>
        <td className="px-4 py-2.5">
          {g.stats.unpaid > 0 ? (
            <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Impayé
            </span>
          ) : (
            <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              À jour
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 text-right">
          {isExpanded ? (
            <ChevronUp className="ml-auto h-4 w-4 text-[var(--foreground-faint)]" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-[var(--foreground-faint)]" />
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-neutral-50 dark:bg-[#181b22]">
          <td colSpan={6} className="px-4 py-5">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-3 text-[13px]">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Informations
                </h3>
                {g.groupe.description && (
                  <p className="text-[var(--foreground-subtle)]">{g.groupe.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">
                    <User className="h-4 w-4 text-[var(--foreground-faint)]" />
                    Prof :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {g.groupe.prof ? `${g.groupe.prof.prenom} ${g.groupe.prof.nom}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">
                    <Calendar className="h-4 w-4 text-[var(--foreground-faint)]" />
                    Inscrit le :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(g.inscription.dateInscription)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">
                    <BookOpen className="h-4 w-4 text-[var(--foreground-faint)]" />
                    Matière :{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {g.groupe.matiere?.nom ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-[13px]">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
                  Ma situation financière
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-[11px] uppercase text-[var(--foreground-faint)]">Total dû</p>
                    <p className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(g.stats.totalDue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-[11px] uppercase text-[var(--foreground-faint)]">Payé</p>
                    <p className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(g.stats.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <p className="text-[11px] uppercase text-[var(--foreground-faint)]">Solde</p>
                    <p
                      className={`text-[13px] font-bold tabular-nums ${
                        g.stats.remainingCredit > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : g.stats.remainingCredit < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {g.stats.remainingCredit > 0 ? "+" : ""}{formatCurrency(g.stats.remainingCredit)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2">
                <button
                  onClick={onOpen}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
                >
                  Détails du groupe <ChevronRight className="h-4 w-4" />
                </button>
                <Link
                  href="/eleve/paiements"
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-[#1e2128]"
                >
                  <DollarSign className="h-4 w-4" /> Voir mes paiements
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
