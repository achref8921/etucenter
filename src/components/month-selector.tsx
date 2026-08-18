"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatMonth(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONTH_LABELS[parseInt(mo) - 1]} ${y}`;
}

function getAdjacentMonth(m: string, dir: -1 | 1): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const currentMonth = getCurrentMonth();

  const navigate = (m: string) => {
    router.push(`?month=${m}`);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(getAdjacentMonth(month, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-400 dark:hover:bg-[#1e2128]"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => navigate(month)}
        className={`min-w-[160px] rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
          month === currentMonth
            ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400"
            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-300 dark:hover:bg-[#1e2128]"
        }`}
      >
        {formatMonth(month)}
      </button>
      <button
        onClick={() => navigate(getAdjacentMonth(month, 1))}
        disabled={month >= currentMonth}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-30 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-400 dark:hover:bg-[#1e2128]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {month !== currentMonth && (
        <button
          onClick={() => navigate(currentMonth)}
          className="ml-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-400 dark:hover:bg-[#1e2128]"
        >
          Aujourd&apos;hui
        </button>
      )}
    </div>
  );
}
