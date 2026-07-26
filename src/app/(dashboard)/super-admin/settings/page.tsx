"use client";

import { Settings } from "lucide-react";

export default function SuperAdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Platform Settings</h1>
        <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Global platform configuration (coming soon)</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-sm text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-900/30">
          <Settings className="h-8 w-8 text-violet-500 dark:text-violet-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Coming Soon</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto dark:text-slate-400">
          Platform-wide settings including subscription plans, email templates,
          default center configuration, and billing integration will be available here.
        </p>
      </div>
    </div>
  );
}
