"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Wallet,
  AlertTriangle,
  Users,
  GraduationCap,
  UserCheck,
  BookOpen,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type StatCardData = {
  title: string;
  value: number;
  format: "currency" | "number";
  icon: string;
  color: string;
  shadow: string;
  href: string;
  sub?: string;
  subTone?: "good" | "bad" | "neutral";
};

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  alert: AlertTriangle,
  users: Users,
  prof: GraduationCap,
  groups: UserCheck,
  book: BookOpen,
  check: UserCheck,
  calendar: Calendar,
  dollar: DollarSign,
  clock: Clock,
};

function AnimatedValue({ value, format }: { value: number; format: "currency" | "number" }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 700;
    const from = 0;
    const to = value;
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  if (format === "currency") return <>{formatCurrency(display)}</>;
  return <>{Math.round(display).toLocaleString("fr-FR")}</>;
}

export function StatCards({ cards }: { cards: StatCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = ICONS[card.icon] ?? Wallet;
        const subTone =
          card.subTone === "good"
            ? "text-green-600 dark:text-green-400"
            : card.subTone === "bad"
              ? "text-red-600 dark:text-red-400"
              : "text-gray-500 dark:text-gray-400";
        return (
          <Link
            key={card.title}
            href={card.href}
            style={{ animationDelay: `${index * 60}ms` }}
            className="group animate-fade-in-up rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.title}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600">
                  <AnimatedValue value={card.value} format={card.format} />
                </p>
                {card.sub && (
                  <p className={`mt-1 text-xs font-medium ${subTone}`}>{card.sub}</p>
                )}
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.color} shadow-md ${card.shadow} transition-transform duration-200 group-hover:scale-110`}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
              Voir details <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

type SeanceData = {
  id: string;
  date: string;
  heureFin?: string | null;
  statut: string;
  groupe: {
    id: string;
    nom: string;
    prof?: { id: string; nom: string; prenom: string } | null;
  };
};

export function SeancesUpcoming({ seances }: { seances: SeanceData[] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const sessionTiming = (s: SeanceData): { label: string; live: boolean } | null => {
    const start = new Date(s.date);
    if (s.statut === "annulee") return null;
    if (s.statut === "en_cours") return { label: "En cours", live: true };
    if (start <= now) {
      const end = s.heureFin ? new Date(s.heureFin) : null;
      if (end && now < end) return { label: "En cours", live: true };
      return null;
    }
    const diff = start.getTime() - now.getTime();
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return { label: "Imminent", live: true };
    if (mins < 60) return { label: `Dans ${mins} min`, live: false };
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { label: m === 0 ? `Dans ${h}h` : `Dans ${h}h ${String(m).padStart(2, "0")}`, live: false };
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Prochaines Séances</h2>
        <Link href="/admin/groupes" className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800">
          Tout voir <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {seances.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Aucune séance planifiée</p>
        ) : (
          seances.map((s) => {
            const timing = sessionTiming(s);
            return (
              <Link
                key={s.id}
                href={`/admin/groupes/${s.groupe.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
                    <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.groupe.nom}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {s.groupe.prof ? `${s.groupe.prof.prenom} ${s.groupe.prof.nom}` : "—"} · {formatDate(s.date)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {timing && (
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        timing.live
                          ? "animate-pulse bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}
                    >
                      {timing.label}
                    </span>
                  )}
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.statut === "planifiee"
                        ? "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
                        : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300"
                    }`}
                  >
                    {s.statut === "planifiee" ? "Planifiée" : "En cours"}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

type ImpayeRow = {
  eleve_id: string;
  eleve_prenom: string;
  eleve_nom: string;
  groupe_id: string;
  groupe_nom: string;
  due_total: number;
  paid_total: number;
  unpaid: number;
};

export function TopImpayes({ rows }: { rows: ImpayeRow[] }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top Impayés</h2>
        <Link href="/admin/finances" className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800">
          Tout voir <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700">
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Élève</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Groupe</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Dû</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Payé</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Progression</th>
              <th className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400">Impayé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-gray-500 dark:text-gray-400">Aucun impayé</td>
              </tr>
            ) : (
              rows.map((item) => {
                const total = item.due_total > 0 ? item.due_total : 0;
                const pct = total > 0 ? Math.min(100, Math.max(0, (item.paid_total / total) * 100)) : 0;
                return (
                  <tr key={item.eleve_id} className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-5 py-3">
                      <Link href={`/admin/eleves/${item.eleve_id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        {item.eleve_prenom} {item.eleve_nom}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/groupes/${item.groupe_id}`} className="text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:underline">
                        {item.groupe_nom}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{formatCurrency(item.due_total)}</td>
                    <td className="px-5 py-3 text-green-600 dark:text-green-400">{formatCurrency(item.paid_total)}</td>
                    <td className="px-5 py-3">
                      <div className="w-28">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{pct.toFixed(0)}% payé</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-red-600 dark:text-red-400">{formatCurrency(item.unpaid)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
