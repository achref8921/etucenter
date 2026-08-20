"use client";

import { useState, useRef } from "react";
import { Download, Upload, Database, Trash2, CheckCircle, AlertTriangle, FileJson, RefreshCw } from "lucide-react";

interface BackupData {
  version: string;
  exportedAt: string;
  centre: string;
  centreSlug: string;
  stats: Record<string, number>;
}

interface RestoreResult {
  success: boolean;
  message: string;
  logs: string[];
  mode: string;
}

export default function AdminBackupPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupData | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [mode, setMode] = useState<"merge" | "full">("merge");
  const [confirmFull, setConfirmFull] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      a.href = url;
      a.download = filenameMatch?.[1] || `backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Erreur lors de l'export: " + (e.message || "Erreur inconnue"));
    }
    setExporting(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setPreview({
          version: data.version || "unknown",
          exportedAt: data.exportedAt || "",
          centre: data.centre || "",
          centreSlug: data.centreSlug || "",
          stats: data.stats || {},
        });
      } catch {
        setPreview(null);
        alert("Fichier JSON invalide");
      }
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file) return;
    if (mode === "full" && !confirmFull) {
      alert("Veuillez confirmer en cochant la case de confirmation");
      return;
    }

    setImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: data, mode }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({
        success: false,
        message: "Erreur: " + (e.message || "Fichier invalide"),
        logs: [],
        mode,
      });
    }
    setImporting(false);
    setConfirmFull(false);
  }

  const statLabels: Record<string, string> = {
    utilisateurs: "Utilisateurs",
    groupes: "Groupes",
    matieres: "Matieres",
    seances: "Seances",
    presences: "Presences",
    paiements: "Paiements",
    inscriptions: "Inscriptions",
    tauxBenefices: "Taux Bénéfices",
    notifications: "Notifications",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Backup & Restauration</h1>
        <p className="text-sm text-neutral-500 mt-1 dark:text-neutral-400">
          Sauvegardez et restaurez les données de votre centre
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EXPORT */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Exporter les données</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Télécharger un fichier JSON avec toutes les données</p>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-4 dark:bg-blue-900/10 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Le fichier de backup contient : utilisateurs, groupes, matières, séances, présences, paiements, inscriptions et taux de bénéfice.
            </p>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white  hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Export en cours..." : "Télécharger le Backup"}
          </button>
        </div>

        {/* IMPORT */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-[#2a2d35] dark:bg-[#181b22]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Upload className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Importer les données</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Restaurer à partir d'un fichier de backup</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm font-medium text-neutral-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors dark:border-[#2a2d35] dark:bg-[#1e2128] dark:text-neutral-400 dark:hover:border-emerald-500"
            >
              <FileJson className="h-5 w-5" />
              {file ? file.name : "Choisir un fichier de backup (.json)"}
            </button>

            {preview && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-[#2a2d35] dark:bg-[#1e2128]">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 dark:text-neutral-400">Aperçu du backup</p>
                <div className="space-y-1 text-sm">
                  <p className="text-neutral-700 dark:text-neutral-300">
                    <strong>Centre :</strong> {preview.centre}
                  </p>
                  <p className="text-neutral-700 dark:text-neutral-300">
                    <strong>Exporté le :</strong>{" "}
                    {preview.exportedAt ? new Date(preview.exportedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(preview.stats).map(([key, val]) => (
                      <span key={key} className="inline-flex items-center gap-1 rounded-md bg-white border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-[#181b22] dark:border-[#2a2d35] dark:text-neutral-400">
                        {statLabels[key] || key}: <strong>{val as number}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide dark:text-neutral-400">Mode d&apos;import</p>
              <div className="flex gap-3">
                <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 text-center transition-colors ${mode === "merge" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-600" : "border-neutral-200 hover:border-neutral-300 dark:border-[#2a2d35]"}`}>
                  <input type="radio" name="mode" value="merge" checked={mode === "merge"} onChange={() => setMode("merge")} className="sr-only" />
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Fusionner</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Ajouter sans écraser</p>
                </label>
                <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 text-center transition-colors ${mode === "full" ? "border-red-500 bg-red-50 dark:bg-red-900/10 dark:border-red-600" : "border-neutral-200 hover:border-neutral-300 dark:border-[#2a2d35]"}`}>
                  <input type="radio" name="mode" value="full" checked={mode === "full"} onChange={() => { setMode("full"); setConfirmFull(false); }} className="sr-only" />
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Remplacement complet</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Supprimer puis importer</p>
                </label>
              </div>

              {mode === "full" && (
                <label className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/10">
                  <input
                    type="checkbox"
                    checked={confirmFull}
                    onChange={(e) => setConfirmFull(e.target.checked)}
                    className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs text-red-700 dark:text-red-400">
                    Je confirme que toutes les données actuelles seront supprimées avant l&apos;import
                  </span>
                </label>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white  disabled:opacity-50 transition-colors ${
                mode === "full" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {importing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : mode === "full" ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {importing ? "Import en cours..." : mode === "full" ? "Remplacer et importer" : "Fusionner et importer"}
            </button>
          </div>
        </div>
      </div>

      {/* RESULT */}
      {result && (
        <div className={`rounded-xl border p-6  ${result.success ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10"}`}>
          <div className="flex items-center gap-3 mb-3">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
            <p className={`text-sm font-semibold ${result.success ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {result.message}
            </p>
          </div>
          {result.logs.length > 0 && (
            <div className="rounded-lg bg-white/50 dark:bg-[#181b22]/50 p-4">
              <p className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Détails</p>
              <ul className="space-y-1">
                {result.logs.map((log, i) => (
                  <li key={i} className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 flex-shrink-0" />
                    {log}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
