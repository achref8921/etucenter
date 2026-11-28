"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { MontantInput } from "@/components/montant-input";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Wallet,
  X as XIcon,
} from "lucide-react";

type SubscriptionState =
  | "none"
  | "active"
  | "due_soon"
  | "due_today"
  | "grace"
  | "overdue"
  | "suspended";

interface Overview {
  centerId: string;
  centerName: string;
  centerActive: boolean;
  usersCount: number;
  subscriptionId: string | null;
  montant: number;
  duree: string | null;
  lastPaymentDate: string | null;
  periodStart: string | null;
  dateFin: string | null;
  daysLeft: number | null;
  daysSincePayment: number | null;
  periodDays: number | null;
  progress: number;
  paidThisMonth: boolean;
  suspendedAt: string | null;
  state: SubscriptionState;
}

interface Summary {
  totalCenters: number;
  active: number;
  dueSoon: number;
  dueToday: number;
  grace: number;
  overdue: number;
  suspended: number;
  withoutSubscription: number;
}

interface ApiData {
  overviews: Overview[];
  summary: Summary;
  generatedAt: string;
}

const STATE_STYLES: Record<SubscriptionState, { label: string; badge: string; dot: string }> = {
  active: {
    label: "Actif",
    badge: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    dot: "bg-green-500",
  },
  due_soon: {
    label: "Échéance proche",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  due_today: {
    label: "À payer aujourd'hui",
    badge: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  grace: {
    label: "Période de grâce",
    badge: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    dot: "bg-red-500",
  },
  overdue: {
    label: "En retard",
    badge: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    dot: "bg-red-500",
  },
  suspended: {
    label: "Comptes gelés",
    badge: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    dot: "bg-neutral-500",
  },
  none: {
    label: "Aucun abonnement",
    badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    dot: "bg-neutral-400",
  },
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function daysLabel(item: Overview): string {
  if (item.daysLeft === null) return "—";
  if (item.daysLeft > 0) return `${item.daysLeft} jour${item.daysLeft > 1 ? "s" : ""} restant${item.daysLeft > 1 ? "s" : ""}`;
  if (item.daysLeft === 0) return "Échéance aujourd'hui";
  return `${-item.daysLeft} jour${item.daysLeft < -1 ? "s" : ""} de retard`;
}

function durationLabel(duree: string | null): string {
  if (duree === "quarter") return "Trimestre";
  if (duree === "year") return "Année";
  if (duree === "month") return "Mois";
  return "—";
}

/** Date du jour au format `YYYY-MM-DD` (UTC, cohérent avec l'affichage). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ajoute des mois à une date `YYYY-MM-DD` sans déborder sur le mois suivant. */
function addMonthsIso(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/** Aperçu de la période qui sera enregistrée (même règle que le serveur). */
function computePeriodPreview(paidAt: string, duree: string, currentDateFin: string | null) {
  const today = todayIso();
  const months = duree === "quarter" ? 3 : duree === "year" ? 12 : 1;
  const backdated = paidAt !== "" && paidAt < today;
  const currentEnd = currentDateFin ? currentDateFin.slice(0, 10) : null;
  const start = backdated
    ? paidAt
    : currentEnd && currentEnd > today
      ? currentEnd
      : today;
  const end = addMonthsIso(start, months);
  const days = Math.round(
    (Date.parse(end + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000
  );
  return {
    start,
    end,
    days,
    backdated,
    historical: backdated && days < 0,
  };
}

export default function SuperAdminSubscriptionsPage() {
  const { success, error: toastError, info } = useToast();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "due" | "grace" | "suspended" | "none">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    centerId: "",
    montant: "",
    duree: "month",
    notes: "",
    paidAt: todayIso(),
  });

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch("/api/super-admin/subscriptions", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erreur de chargement");
      setData(json);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Impossible de charger les abonnements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const list = data?.overviews ?? [];
    if (filter === "all") return list;
    if (filter === "due")
      return list.filter((o) => o.state === "due_soon" || o.state === "due_today");
    if (filter === "grace") return list.filter((o) => o.state === "grace" || o.state === "overdue");
    if (filter === "suspended") return list.filter((o) => o.state === "suspended");
    return list.filter((o) => o.state === "none");
  }, [data, filter]);

  const centers = useMemo(
    () => (data?.overviews ?? []).map((o) => ({ id: o.centerId, name: o.centerName, montant: o.montant })),
    [data]
  );

  const selectedOverview = useMemo(
    () => (data?.overviews ?? []).find((o) => o.centerId === form.centerId) ?? null,
    [data, form.centerId]
  );

  const periodPreview = useMemo(
    () => computePeriodPreview(form.paidAt, form.duree, selectedOverview?.dateFin ?? null),
    [form.paidAt, form.duree, selectedOverview?.dateFin]
  );

  function openPayment(centerId?: string) {
    const target = centerId ? data?.overviews.find((o) => o.centerId === centerId) : undefined;
    setForm({
      centerId: centerId ?? "",
      montant: target && target.montant > 0 ? String(target.montant) : "",
      duree: target?.duree === "quarter" || target?.duree === "year" ? target.duree : "month",
      notes: "",
      paidAt: todayIso(),
    });
    setModalOpen(true);
  }

  async function runReminders() {
    setRunning(true);
    try {
      const res = await fetch("/api/super-admin/subscriptions/notify", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erreur lors de la vérification");
      const created =
        (json.reminderJ3 ?? 0) +
        (json.dueToday ?? 0) +
        (json.graceWarnings ?? 0);
      if (json.suspendedCenters > 0) {
        info(`${json.suspendedCenters} centre(s) gelé(s) : ${(json.suspendedNames ?? []).join(", ")}`);
      }
      success(
        `Vérification terminée : ${created} rappel(s) envoyé(s), ${json.checkedCenters ?? 0} centre(s) analysé(s).`
      );
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Erreur lors de la vérification");
    } finally {
      setRunning(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!form.centerId || !form.montant) {
      toastError("Sélectionnez un centre et saisissez le montant.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centerId: form.centerId,
          montant: Number(form.montant),
          duree: form.duree,
          notes: form.notes || undefined,
          paidAt: form.paidAt || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erreur lors de l'enregistrement");

      success(json.message || "Paiement enregistré. Le compteur de jours a démarré.");
      if (json.alreadyPaidThisMonth) {
        info("Ce centre avait déjà payé l'abonnement de ce mois : renouvellement anticipé enregistré.");
      }
      if (json.backdated && !json.affectsCurrentPeriod) {
        info("Paiement historique enregistré : le compteur actuel n'est pas modifié.");
      }
      setModalOpen(false);
      setForm({ centerId: "", montant: "", duree: "month", notes: "", paidAt: todayIso() });
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const summary = data?.summary;
  const isBackdated = form.paidAt !== "" && form.paidAt < todayIso();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Abonnements & paiements
          </h1>
          <p className="mt-1 text-[13px] text-[var(--foreground-faint)]">
            Rappels automatiques, compteur de jours et gel des centres impayés.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runReminders}
            disabled={running}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-100/60 disabled:opacity-50 dark:hover:bg-[#1e2128]"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Vérifier maintenant
          </button>
          <button
            onClick={() => openPayment()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Enregistrer un paiement
          </button>
        </div>
      </div>

      {/* Règle métier */}
      <div className="rounded-[18px] border border-blue-200 bg-blue-50/70 p-4 text-[13px] text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
        <p className="font-semibold">Cycle automatique quotidien</p>
        <p className="mt-1 leading-relaxed">
          J-3 : rappel « il reste 3 jours ». Jour J : rappel « à payer aujourd'hui ». J+1 à J+3 :
          rappel de grâce. J+4 : gel automatique des comptes du centre. Enregistrer un paiement
          réactive le centre et redémarre le compteur.
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard
          label="Centres"
          value={summary?.totalCenters ?? 0}
          hint={`${summary?.withoutSubscription ?? 0} sans abonnement`}
          icon={<Building2 className="h-5 w-5 text-neutral-500" />}
        />
        <KpiCard
          label="Actifs"
          value={summary?.active ?? 0}
          hint="compteur en cours"
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
        />
        <KpiCard
          label="Échéance proche"
          value={summary?.dueSoon ?? 0}
          hint={`${summary?.dueToday ?? 0} à payer aujourd'hui`}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
        />
        <KpiCard
          label="En grâce"
          value={(summary?.grace ?? 0) + (summary?.overdue ?? 0)}
          hint="gel imminent"
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
        />
        <KpiCard
          label="Gelés"
          value={summary?.suspended ?? 0}
          hint="abonnement impayé"
          icon={<Lock className="h-5 w-5 text-neutral-500" />}
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Tous"],
            ["due", "À échoir"],
            ["grace", "Grâce / retard"],
            ["suspended", "Gelés"],
            ["none", "Sans abonnement"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              filter === key
                ? "bg-blue-600 text-white"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-subtle)] hover:bg-neutral-100/60 dark:hover:bg-[#1e2128]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[var(--foreground-faint)]">
            Aucun centre dans cette catégorie.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <Th>Centre</Th>
                  <Th>Dernier paiement</Th>
                  <Th>Échéance</Th>
                  <Th>Compteur</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((item) => {
                  const style = STATE_STYLES[item.state];
                  return (
                    <tr key={item.centerId} className="hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                          <div>
                            <p className="font-medium text-[var(--foreground)]">{item.centerName}</p>
                            <p className="text-xs text-[var(--foreground-faint)]">
                              {item.usersCount} utilisateur{item.usersCount > 1 ? "s" : ""}
                              {item.montant > 0
                                ? ` · ${item.montant.toLocaleString("fr-TN")} DT / ${durationLabel(item.duree).toLowerCase()}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground-subtle)]">
                        {fmtDate(item.lastPaymentDate)}
                        {item.paidThisMonth && (
                          <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            Payé ce mois
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground-subtle)]">
                        {fmtDate(item.dateFin)}
                        <p className="text-xs text-[var(--foreground-faint)]">{daysLabel(item)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {item.periodDays ? (
                          <div className="w-36">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                              <div
                                className={`h-full rounded-full ${
                                  item.state === "active"
                                    ? "bg-green-500"
                                    : item.state === "due_soon"
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(100, item.progress)}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-[var(--foreground-faint)]">
                              J+{item.daysSincePayment ?? 0} / {item.periodDays} jours
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--foreground-faint)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openPayment(item.centerId)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-subtle)] hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Payer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && (
        <p className="text-right text-[11px] text-[var(--foreground-faint)]">
          Dernière actualisation : {new Date(data.generatedAt).toLocaleString("fr-FR")}
        </p>
      )}

      {/* Modal paiement */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
                  <CalendarClock className="h-5 w-5 text-blue-600" />
                  Enregistrer un paiement
                </h2>
                <p className="mt-1 text-xs text-[var(--foreground-faint)]">
                  Le compteur de jours démarre immédiatement.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                aria-label="Fermer"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitPayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">
                  Centre
                </label>
                <select
                  value={form.centerId}
                  onChange={(e) => {
                    const center = centers.find((c) => c.id === e.target.value);
                    setForm({
                      ...form,
                      centerId: e.target.value,
                      montant: center && center.montant > 0 ? String(center.montant) : form.montant,
                    });
                  }}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un centre</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedOverview?.paidThisMonth && (
                <div className="flex items-start gap-2 rounded-lg bg-green-50/80 p-3 text-[12px] text-green-900 dark:bg-green-950/20 dark:text-green-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Ce centre a déjà payé l&apos;abonnement de ce mois
                    {selectedOverview.lastPaymentDate
                      ? ` (le ${fmtDate(selectedOverview.lastPaymentDate)}).`
                      : "."}{" "}
                    Le compteur est actif : prochaine échéance le {fmtDate(selectedOverview.dateFin)}. Un
                    nouveau paiement sera enregistré comme renouvellement anticipé, ou comme paiement
                    historique si vous choisissez une date passée.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">
                  Date du paiement
                </label>
                <input
                  type="date"
                  value={form.paidAt}
                  max={todayIso()}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {isBackdated ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Paiement rétroactif : la période est calculée à partir de cette date. Si elle se
                    termine avant l&apos;abonnement actuel, elle est conservée comme historique sans
                    modifier le compteur.
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-[var(--foreground-faint)]">
                    Laissez la date du jour, ou choisissez une date passée pour saisir un ancien
                    paiement.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">
                    Montant (DT)
                  </label>
                  <MontantInput
                    value={form.montant ? parseFloat(form.montant) || 0 : ""}
                    onChange={(v) => setForm({ ...form, montant: v === 0 ? "" : String(v) })}
                    min={0}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Ex: 200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">
                    Durée
                  </label>
                  <select
                    value={form.duree}
                    onChange={(e) => setForm({ ...form, duree: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="month">1 mois</option>
                    <option value="quarter">3 mois</option>
                    <option value="year">1 an</option>
                  </select>
                </div>
              </div>

              <div
                className={`rounded-lg border p-3 text-[12px] ${
                  periodPreview.historical
                    ? "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                    : "border-[var(--border)] bg-neutral-50/60 text-[var(--foreground-subtle)] dark:bg-[#1a1d23]"
                }`}
              >
                <p className="font-semibold text-[var(--foreground)]">
                  Période calculée : {fmtDate(periodPreview.start)} → {fmtDate(periodPreview.end)}
                </p>
                <p className="mt-0.5">
                  {periodPreview.historical
                    ? "Période déjà terminée : elle sera conservée comme historique, sans modifier le compteur actuel."
                    : periodPreview.days > 0
                      ? `${periodPreview.days} jour${periodPreview.days > 1 ? "s" : ""} restant${periodPreview.days > 1 ? "s" : ""} après enregistrement.`
                      : "Échéance aujourd'hui."}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">
                  Notes (optionnel)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Référence, moyen de paiement…"
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-blue-50/70 p-3 text-[12px] text-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                <Bell className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Une notification sera envoyée au compte super admin et le centre sera réactivé
                  s&apos;il était gelé pour abonnement impayé.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.centerId || !form.montant}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{value}</p>
          <p className="text-[11px] text-[var(--foreground-faint)]">{hint}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-[#1e2128]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)] ${className}`}
    >
      {children}
    </th>
  );
}
