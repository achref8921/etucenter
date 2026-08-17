"use client";

import { useEffect, useState } from "react";
import { Power, PowerOff, RotateCcw, Search, Loader2, X, KeyRound, Database, History } from "lucide-react";
import PasswordInput from "@/components/password-input";

interface UtilisateurData {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: "admin" | "prof" | "eleve" | "super_admin";
  actif: boolean;
  deletedAt: string | null;
  provider: string | null;
  codeEleve: string | null;
  codeProf: string | null;
  centerId: string;
  createdAt: string;
  center: { id: string; name: string; active: boolean };
}

interface CenterOption {
  id: string;
  name: string;
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  prof: "Prof",
  eleve: "Élève",
  super_admin: "Super Admin",
};

export default function SuperAdminUtilisateursPage() {
  const [users, setUsers] = useState<UtilisateurData[]>([]);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [centerFilter, setCenterFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("TOUS");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<UtilisateurData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetError, setResetError] = useState("");
  const [restoreUser, setRestoreUser] = useState<UtilisateurData | null>(null);
  const [restoreBackups, setRestoreBackups] = useState<RestoreCandidate[]>([]);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  interface RestoreCandidate {
    id: string;
    version: number;
    type: string;
    createdAt: string;
    sizeBytes: number | null;
    restoredAt: string | null;
    hasPassword: boolean;
    actif: boolean;
    counts: { inscriptions: number; paiements: number; presences: number; tauxBenefice: number; notifications: number };
  }

  interface RestoreResult {
    restoredCounts: { inscriptions: number; paiements: number; presences: number; tauxBenefice: number; notifications: number };
    passwordRestored: boolean;
  }

  async function loadUsers() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (centerFilter) params.set("centerId", centerFilter);
    if (statutFilter !== "TOUS") params.set("statut", statutFilter);
    const res = await fetch(`/api/super-admin/utilisateurs?${params.toString()}`);
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/super-admin/centers")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setCenters(Array.isArray(data) ? data.map((c: CenterOption) => ({ id: c.id, name: c.name })) : [])
      )
      .catch(() => setCenters([]));
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyFilters() {
    loadUsers();
  }

  async function toggleActif(user: UtilisateurData, targetActif: boolean) {
    setTogglingId(user.id);
    setError("");
    const res = await fetch("/api/super-admin/utilisateurs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, actif: targetActif }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Erreur");
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, actif: targetActif, deletedAt: targetActif ? null : u.deletedAt } : u
        )
      );
    }
    setTogglingId(null);
  }

  async function handleResetPassword() {
    if (!resetUser) return;
    setResetSubmitting(true);
    setResetError("");
    const res = await fetch("/api/super-admin/utilisateurs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetUser.id, motDePasse: newPassword }),
    });
    if (!res.ok) {
      const body = await res.json();
      setResetError(body.error || "Erreur");
      setResetSubmitting(false);
      return;
    }
    setResetUser(null);
    setNewPassword("");
    setResetSubmitting(false);
  }

  async function openRestore(user: UtilisateurData) {
    setRestoreUser(user);
    setRestoreBackups([]);
    setSelectedBackupId("");
    setRestoreError("");
    setRestoreResult(null);
    setRestoreLoading(true);
    try {
      const res = await fetch(`/api/super-admin/utilisateurs/${user.id}/restore`);
      if (!res.ok) {
        const body = await res.json();
        setRestoreError(body.error || "Erreur");
      } else {
        const data = await res.json();
        setRestoreBackups(data.backups || []);
        if (data.backups?.length > 0) setSelectedBackupId(data.backups[0].id);
      }
    } catch {
      setRestoreError("Erreur de chargement");
    } finally {
      setRestoreLoading(false);
    }
  }

  async function confirmRestore() {
    if (!restoreUser || !selectedBackupId) return;
    setRestoring(true);
    setRestoreError("");
    setRestoreResult(null);
    const res = await fetch(`/api/super-admin/utilisateurs/${restoreUser.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupId: selectedBackupId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setRestoreError(body.error || "Erreur");
      setRestoring(false);
      return;
    }
    setRestoreResult(body);
    setUsers((prev) => prev.map((u) => (u.id === restoreUser.id ? { ...u, actif: true, deletedAt: null } : u)));
    setRestoring(false);
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function statusBadge(u: UtilisateurData) {
    if (u.deletedAt) {
      return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">Archivé</span>;
    }
    if (u.actif) {
      return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Actif</span>;
    }
    return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">Inactif</span>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Utilisateurs</h1>
        <p className="text-[13px] text-neutral-500 mt-1 dark:text-neutral-400">Restaurer ou réactiver n'importe quel compte sur tous les centres</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, code élève/prof..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2.5 text-[13px] text-neutral-900 placeholder-neutral-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-violet-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-700 focus:border-violet-500 focus:outline-none dark:border-[#2a2d35] dark:bg-[#1e2128] dark:text-neutral-200"
          >
            <option value="">Tous les rôles</option>
            <option value="admin">Admins</option>
            <option value="prof">Professeurs</option>
            <option value="eleve">Élèves</option>
          </select>
          <select
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-700 focus:border-violet-500 focus:outline-none dark:border-[#2a2d35] dark:bg-[#1e2128] dark:text-neutral-200"
          >
            <option value="">Tous les centres</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-700 focus:border-violet-500 focus:outline-none dark:border-[#2a2d35] dark:bg-[#1e2128] dark:text-neutral-200"
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="ACTIF">Actifs</option>
            <option value="INACTIF">Inactifs</option>
            <option value="ARCHIVE">Archivés</option>
          </select>
          <button
            onClick={applyFilters}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-700 transition-colors dark:hover:bg-violet-500"
          >
            Rechercher
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto dark:border-[#2a2d35] dark:bg-[#181b22]">
        <table className="min-w-full divide-y divide-neutral-100 dark:divide-[#2a2d35]">
          <thead className="bg-neutral-50 dark:bg-[#1e2128]">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Utilisateur</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Centre</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Rôle</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Statut</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Créé le</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-neutral-400 dark:text-neutral-500">Chargement...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-neutral-400 dark:text-neutral-500">Aucun utilisateur trouvé.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-100/50 transition-colors dark:hover:bg-[#1e2128]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-[#1e2128] text-xs font-bold text-neutral-500">
                      {u.prenom[0]}{u.nom[0]}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</p>
                      {(u.codeEleve || u.codeProf) && (
                        <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">{u.codeEleve ? `Élève ${u.codeEleve}` : `Prof ${u.codeProf}`}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div>
                    <p className="text-[13px] text-neutral-700 dark:text-neutral-300">{u.center.name}</p>
                    {!u.center.active && (
                      <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">Centre suspendu</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[13px] text-neutral-700 dark:text-neutral-300">{roleLabels[u.role] || u.role}</td>
                <td className="px-4 py-2.5">{statusBadge(u)}</td>
                <td className="px-4 py-2.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                  {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {(!u.actif || u.deletedAt) ? (
                      <button
                        onClick={() => toggleActif(u, true)}
                        disabled={togglingId === u.id}
                        title="Activer le compte"
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                      >
                        {togglingId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Activer
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleActif(u, false)}
                        disabled={togglingId === u.id}
                        title="Désactiver"
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        {togglingId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PowerOff className="h-3.5 w-3.5" />}
                        Désactiver
                      </button>
                    )}
                    <button
                      onClick={() => openRestore(u)}
                      title="Restaurer les dernières données depuis une sauvegarde"
                      className="rounded-lg p-1.5 text-neutral-400 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-neutral-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setResetUser(u); setNewPassword(""); setResetError(""); }}
                      title="Réinitialiser le mot de passe"
                      className="rounded-lg p-1.5 text-neutral-400 hover:bg-violet-50 hover:text-violet-600 transition-colors dark:text-neutral-500 dark:hover:bg-violet-900/20 dark:hover:text-violet-400"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-[#181b22]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Réinitialiser le mot de passe</h2>
              <button onClick={() => { setResetUser(null); setNewPassword(""); }} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-[13px] text-neutral-600 dark:text-neutral-400">
              Définir un nouveau mot de passe pour <span className="font-semibold text-neutral-900 dark:text-neutral-100">{resetUser.prenom} {resetUser.nom}</span> ({resetUser.center.name}).
            </p>
            {resetError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{resetError}</div>
            )}
            <div>
              <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Nouveau mot de passe (min 8 caractères)</label>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-[#2a2d35] dark:bg-[#181b22] dark:text-neutral-100 dark:focus:border-violet-400" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setResetUser(null); setNewPassword(""); }} className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-[#1e2128]">Annuler</button>
              <button onClick={handleResetPassword} disabled={resetSubmitting || newPassword.length < 8} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:hover:bg-violet-500">
                {resetSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      {restoreUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-[#181b22]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-[#1e2128]">
                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Restaurer les données</h2>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                    {restoreUser.prenom} {restoreUser.nom} — {restoreUser.center.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setRestoreUser(null)} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {restoreResult ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <span className="font-semibold">Compte restauré avec succès.</span>{" "}
                  {restoreResult.passwordRestored
                    ? "Le mot de passe de l'époque a été restauré."
                    : "La sauvegarde ne contenait pas de mot de passe : celui du compte actuel a été conservé."}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    ["Inscriptions", restoreResult.restoredCounts.inscriptions],
                    ["Paiements", restoreResult.restoredCounts.paiements],
                    ["Présences", restoreResult.restoredCounts.presences],
                    ["Notifications", restoreResult.restoredCounts.notifications],
                    ["Taux prof", restoreResult.restoredCounts.tauxBenefice],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg bg-neutral-50 px-4 py-3 text-center dark:bg-[#1e2128]">
                      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setRestoreUser(null)} className="rounded-lg bg-neutral-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-neutral-700">Fermer</button>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 text-[13px] text-neutral-600 dark:text-neutral-400">
                  Choisissez la version de sauvegarde à partir de laquelle restaurer le profil et toutes les données liées (inscriptions, paiements, présences, notifications). Les données actuelles de ce compte seront remplacées.
                </p>
                {restoreError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{restoreError}</div>
                )}
                {restoreLoading ? (
                  <div className="py-8 text-center text-[13px] text-neutral-400 dark:text-neutral-500">Chargement des sauvegardes...</div>
                ) : restoreBackups.length === 0 && !restoreError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-[13px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                    Aucune sauvegarde ne contient de données pour ce compte.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {restoreBackups.map((b) => {
                      const selected = selectedBackupId === b.id;
                      return (
                        <button
                          key={b.id}
                          onClick={() => setSelectedBackupId(b.id)}
                          className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${selected ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20" : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 dark:border-[#2a2d35] dark:bg-[#1e2128] dark:hover:border-neutral-600"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">V{b.version}</span>
                              <div>
                                <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                                  {new Date(b.createdAt).toLocaleString("fr-FR")}
                                  {b.restoredAt && <span className="ml-2 text-xs font-normal text-neutral-400">(déjà restaurée)</span>}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {b.type === "automatique" ? "Automatique" : "Manuelle"} · {formatSize(b.sizeBytes)} · {b.hasPassword ? "mot de passe ✓" : "sans mot de passe"}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                              <span className="rounded-md bg-white px-1.5 py-0.5 dark:bg-[#2a2d35]">{b.counts.inscriptions} insc.</span>
                              <span className="rounded-md bg-white px-1.5 py-0.5 dark:bg-[#2a2d35]">{b.counts.paiements} paiem.</span>
                              <span className="rounded-md bg-white px-1.5 py-0.5 dark:bg-[#2a2d35]">{b.counts.presences} prés.</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" onClick={() => setRestoreUser(null)} className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-[#1e2128]">Annuler</button>
                  <button
                    onClick={confirmRestore}
                    disabled={restoring || !selectedBackupId || restoreBackups.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:hover:bg-blue-500"
                  >
                    {restoring && <Loader2 className="h-4 w-4 animate-spin" />} Restaurer les données
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
