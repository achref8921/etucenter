"use client";

import { useEffect, useState } from "react";
import { Plus, Power, PowerOff, Eye, X, Trash2, Users, UserPlus, Search } from "lucide-react";
import ConfirmDelete from "@/components/confirm-delete";

interface CenterData {
  id: string;
  name: string;
  slug: string;
  code: string;
  logo: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  createdAt: string;
  _count: { utilisateurs: number; groupes: number; matieres: number };
}

interface AdminData {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  actif: boolean;
  createdAt: string;
}

export default function SuperAdminCentersPage() {
  const [centers, setCenters] = useState<CenterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showStats, setShowStats] = useState<CenterData | null>(null);
  const [showDelete, setShowDelete] = useState<CenterData | null>(null);
  const [showAdmins, setShowAdmins] = useState<CenterData | null>(null);
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", phone: "", address: "", adminEmail: "", adminPassword: "admin123", adminNom: "", adminPrenom: "" });
  const [adminForm, setAdminForm] = useState({ email: "", password: "admin123", nom: "", prenom: "", telephone: "" });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [error, setError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  async function loadCenters() {
    const res = await fetch("/api/super-admin/centers");
    if (res.ok) setCenters(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadCenters(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    const res = await fetch("/api/super-admin/centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create center");
      setCreating(false);
      return;
    }
    setShowCreate(false);
    setCreatedCode(data.center?.code ?? null);
    setForm({ name: "", slug: "", phone: "", address: "", adminEmail: "", adminPassword: "admin123", adminNom: "", adminPrenom: "" });
    setSlugManuallyEdited(false);
    setCreating(false);
    loadCenters();
  }

  async function toggleActive(id: string, current: boolean) {
    if (togglingId) return;
    setTogglingId(id);
    setCenters((prev) => prev.map((c) => (c.id === id ? { ...c, active: !current } : c)));
    const res = await fetch(`/api/super-admin/centers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    if (!res.ok) {
      setCenters((prev) => prev.map((c) => (c.id === id ? { ...c, active: current } : c)));
    }
    setTogglingId(null);
  }

  async function handleDelete() {
    if (!showDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/super-admin/centers/${showDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setShowDelete(null);
      loadCenters();
    }
    setDeleting(false);
  }

  async function openAdmins(center: CenterData) {
    setShowAdmins(center);
    setAdminsLoading(true);
    const res = await fetch(`/api/super-admin/centers/${center.id}/admins`);
    if (res.ok) setAdmins(await res.json());
    setAdminsLoading(false);
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!showAdmins) return;
    setAdminError("");
    setCreatingAdmin(true);
    const res = await fetch(`/api/super-admin/centers/${showAdmins.id}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setAdminError(data.error);
      setCreatingAdmin(false);
      return;
    }
    setAdmins((prev) => [data, ...prev]);
    setAdminForm({ email: "", password: "admin123", nom: "", prenom: "", telephone: "" });
    setShowAddAdmin(false);
    setCreatingAdmin(false);
  }

  async function toggleAdminActive(adminId: string, current: boolean) {
    if (!showAdmins) return;
    const res = await fetch(`/api/super-admin/centers/${showAdmins.id}/admins/${adminId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !current }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAdmins((prev) => prev.map((a) => (a.id === adminId ? updated : a)));
    }
  }

  async function deleteAdmin(adminId: string) {
    if (!showAdmins) return;
    const res = await fetch(`/api/super-admin/centers/${showAdmins.id}/admins/${adminId}`, { method: "DELETE" });
    if (res.ok) {
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Centers Management</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Manage all tenants on the platform</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 hover:bg-violet-700 transition-colors dark:shadow-violet-900/30 dark:hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" />
          Add Center
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par ID ou nom du centre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-violet-400"
        />
      </div>

      {createdCode && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          <span className="font-semibold">Centre créé.</span> Code du centre :{" "}
          <span className="inline-block rounded-md bg-white px-2 py-0.5 font-mono font-bold tracking-widest text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300">
            {createdCode}
          </span>
          <button
            onClick={() => setCreatedCode(null)}
            className="ml-3 text-xs font-semibold text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
          >
            Fermer
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create New Center</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>
            )}
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="border-b border-slate-100 pb-4 dark:border-slate-700">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Center Information</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Center Name *</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm({
                          ...form,
                          name,
                          slug: slugManuallyEdited
                            ? form.slug
                            : name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                        });
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                      placeholder="e.g. Centre El Fath"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Slug (URL key) *</label>
                    <input
                      required
                      value={form.slug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") });
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                      placeholder="Auto-generated from name"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Phone</label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                        placeholder="+216 XX XXX XXX"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Address</label>
                      <input
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                        placeholder="City, Country"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Admin Account</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Admin First Name *</label>
                      <input
                        required
                        value={form.adminPrenom}
                        onChange={(e) => setForm({ ...form, adminPrenom: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                        placeholder="e.g. Ahmed"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Admin Last Name *</label>
                      <input
                        required
                        value={form.adminNom}
                        onChange={(e) => setForm({ ...form, adminNom: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                        placeholder="e.g. Ben Ali"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Admin Email *</label>
                    <input
                      required
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                      placeholder="admin@centre-el-fath.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Initial Password *</label>
                    <input
                      required
                      type="text"
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:bg-slate-900"
                      placeholder="admin123"
                    />
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Admin can change this after first login</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 dark:hover:bg-violet-500">
                  {creating ? "Creating..." : "Create Center + Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {showStats.logo ? (
                  <img src={showStats.logo} alt={showStats.name} className="h-10 w-10 rounded-xl object-contain border border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    {showStats.name[0]}
                  </div>
                )}
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{showStats.name}</h2>
              </div>
              <button onClick={() => setShowStats(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">Users</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{showStats._count.utilisateurs}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">Groups</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{showStats._count.groupes}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">Subjects</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{showStats._count.matieres}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">Status</span>
                <span className={`text-sm font-bold ${showStats.active ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {showStats.active ? "Active" : "Suspended"}
                </span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">Created</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{new Date(showStats.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDelete
        open={!!showDelete}
        title="Supprimer le centre"
        message={`Vous êtes sur le point de supprimer ${showDelete?.name}. Le centre sera désactivé : les administrateurs pourront se connecter en lecture seule (compte gelé) et toutes les données seront conservées.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(null)}
        loading={deleting}
      />

      {showAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                  <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Admins — {showAdmins.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{admins.length} admin(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddAdmin(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Ajouter un admin
                </button>
                <button onClick={() => { setShowAdmins(null); setShowAddAdmin(false); }} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {showAddAdmin && (
              <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                <h3 className="mb-3 text-sm font-bold text-violet-900 dark:text-violet-300">Nouvel Admin</h3>
                {adminError && (
                  <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{adminError}</div>
                )}
                <form onSubmit={handleAddAdmin} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Prénom *</label>
                      <input
                        required
                        value={adminForm.prenom}
                        onChange={(e) => setAdminForm({ ...adminForm, prenom: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
                        placeholder="Ahmed"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Nom *</label>
                      <input
                        required
                        value={adminForm.nom}
                        onChange={(e) => setAdminForm({ ...adminForm, nom: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
                        placeholder="Ben Ali"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Email *</label>
                    <input
                      required
                      type="email"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
                      placeholder="admin2@centre-el-fath.com"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Mot de passe *</label>
                      <input
                        required
                        type="text"
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
                        placeholder="admin123"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Téléphone</label>
                      <input
                        value={adminForm.telephone}
                        onChange={(e) => setAdminForm({ ...adminForm, telephone: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-violet-400"
                        placeholder="+216 XX XXX XXX"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => { setShowAddAdmin(false); setAdminError(""); }} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                      Annuler
                    </button>
                    <button type="submit" disabled={creatingAdmin} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:hover:bg-violet-500">
                      {creatingAdmin ? "Création..." : "Créer l'admin"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {adminsLoading ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Chargement...</div>
            ) : admins.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">Aucun admin trouvé</div>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                        {admin.prenom[0]}{admin.nom[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{admin.prenom} {admin.nom}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{admin.email}</p>
                        {admin.telephone && <p className="text-xs text-slate-400 dark:text-slate-500">{admin.telephone}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${admin.actif ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                        {admin.actif ? "Actif" : "Inactif"}
                      </span>
                      <button
                        onClick={() => toggleAdminActive(admin.id, admin.actif)}
                        title={admin.actif ? "Désactiver" : "Activer"}
                        className={`rounded-lg p-1.5 transition-colors ${admin.actif ? "text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"}`}
                      >
                        {admin.actif ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteAdmin(admin.id)}
                        title="Supprimer"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-400">Loading...</div>
        ) : (() => {
          const q = searchQuery.toLowerCase();
          const filtered = centers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
          return filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">Aucun centre trouvé.</div>
          ) : filtered.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-3">
              {c.logo ? (
                <img src={c.logo} alt={c.name} className="h-10 w-10 rounded-lg object-contain border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                  {c.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{c.name}</p>
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{c.id.slice(0, 8)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{c.phone || "No phone"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                  {c.code}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                  {c.active ? "Active" : "Suspended"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
              <span>{c._count.utilisateurs} users</span>
              <span>{c._count.groupes} groups</span>
              <span className="ml-auto text-slate-400">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => openAdmins(c)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-50 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/30 transition-colors">
                <Users className="h-3.5 w-3.5" /> Admins
              </button>
              <button onClick={() => setShowStats(c)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors">
                <Eye className="h-3.5 w-3.5" /> Stats
              </button>
              <button onClick={() => toggleActive(c.id, c.active)} disabled={togglingId === c.id} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${c.active ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"}`}>
                {c.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                {c.active ? "Suspend" : "Activate"}
              </button>
              <button onClick={() => setShowDelete(c)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ));
        })()}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Center</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">ID</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Slug</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Users</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Groups</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</td></tr>
            ) : (() => {
              const q = searchQuery.toLowerCase();
              const filtered = centers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
              return filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Aucun centre trouvé.</td></tr>
              ) : filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-slate-800">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {c.logo ? (
                      <img src={c.logo} alt={c.name} className="h-9 w-9 rounded-lg object-contain border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                        {c.name[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{c.phone || "No phone"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">{c.code}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400">{c.id.slice(0, 8)}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">{c.slug}</span>
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{c._count.utilisateurs}</td>
                <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{c._count.groupes}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                    {c.active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">
                  {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openAdmins(c)} title="Gérer les admins" className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors dark:text-slate-500 dark:hover:bg-violet-900/20 dark:hover:text-violet-400">
                      <Users className="h-4 w-4" />
                    </button>
                    <button onClick={() => setShowStats(c)} title="Quick Stats" className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-slate-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleActive(c.id, c.active)} disabled={togglingId === c.id} title={c.active ? "Suspend" : "Activate"} className={`rounded-lg p-1.5 transition-colors disabled:opacity-40 ${c.active ? "text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"}`}>
                      {c.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setShowDelete(c)} title="Delete Center" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:text-slate-500 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
