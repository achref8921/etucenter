"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Database, Settings2, UserPlus, Wrench, CheckCircle2 } from "lucide-react";

export default function SuperAdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [retention, setRetention] = useState("14");
  const [maintenance, setMaintenance] = useState(false);
  const [openRegistration, setOpenRegistration] = useState(true);

  async function loadSettings() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/super-admin/settings");
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Erreur de chargement");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const s = data.settings || {};
    setRetention(s.backupRetention ?? "14");
    setMaintenance(s.maintenanceMode === "true");
    setOpenRegistration(s.openRegistration !== "false");
    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        backupRetention: String(retention),
        maintenanceMode: String(maintenance),
        openRegistration: String(openRegistration),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erreur lors de l'enregistrement");
      setSaving(false);
      return;
    }
    const s = data.settings || {};
    setRetention(s.backupRetention ?? retention);
    setMaintenance(s.maintenanceMode === "true");
    setOpenRegistration(s.openRegistration !== "false");
    setSuccess("Réglages enregistrés avec succès.");
    setSaving(false);
    setTimeout(() => setSuccess(""), 4000);
  }

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${checked ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-600"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    );
  }

  function Card({ icon: Icon, iconClass, title, description, children }: { icon: any; iconClass: string; title: string; description: string; children: React.ReactNode }) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Paramètres de la plateforme</h1>
        <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Configuration globale appliquée à toute la plateforme</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 dark:text-violet-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            icon={Database}
            iconClass="bg-violet-600"
            title="Rétention des sauvegardes"
            description="Nombre de jours pendant lesquels les sauvegardes sont conservées avant suppression automatique"
          >
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Jours de rétention</label>
            <input
              type="number"
              min={1}
              max={365}
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
            />
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Entre 1 et 365 jours. Valeur actuelle du serveur : <span className="font-mono font-semibold">{retention}</span></p>
          </Card>

          <Card
            icon={UserPlus}
            iconClass="bg-emerald-600"
            title="Inscriptions ouvertes"
            description="Autorise ou bloque la création de nouveaux comptes via la page d'inscription"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{openRegistration ? "Ouvertes" : "Fermées"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {openRegistration ? "Les nouveaux utilisateurs peuvent s'inscrire." : "Les nouvelles inscriptions sont bloquées."}
                </p>
              </div>
              <Toggle checked={openRegistration} onChange={setOpenRegistration} />
            </div>
          </Card>

          <Card
            icon={Wrench}
            iconClass="bg-amber-600"
            title="Mode maintenance"
            description="Bloque temporairement l'accès à tous les comptes (hors super admin) pendant la maintenance"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{maintenance ? "Actif" : "Inactif"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {maintenance ? "Les utilisateurs sont redirigés vers la page de maintenance." : "Accès normal pour tous les utilisateurs."}
                </p>
              </div>
              <Toggle checked={maintenance} onChange={setMaintenance} />
            </div>
          </Card>

          <Card
            icon={Settings2}
            iconClass="bg-blue-600"
            title="Notes"
            description="Les modifications sont journalisées dans les System Logs"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Chaque modification de ces réglages est enregistrée avec le compte du super admin et l&apos;horodatage,
              consultables dans <span className="font-semibold text-slate-700 dark:text-slate-300">System Logs</span>.
            </p>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 dark:hover:bg-violet-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Enregistrement..." : "Enregistrer les réglages"}
        </button>
      </div>
    </div>
  );
}
