"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Trash2, X, Loader2, Filter, ToggleLeft, ToggleRight, Search, Download, KeyRound } from "lucide-react";
import PasswordInput from "@/components/password-input";
import ConfirmDelete from "@/components/confirm-delete";

interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: string;
  actif: boolean;
  codeEleve: string | null;
  codeProf: string | null;
  niveau: string | null;
  classe: string | null;
  filiere: string | null;
}

const classesByNiveau: Record<string, string[]> = {
  primaire: ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année", "6ème année"],
  college: ["7ème", "8ème", "9ème"],
  lycee: ["1ère", "2ème", "3ème", "Bac"],
};

const filieres = [
  { value: "lettres", label: "Lettres" },
  { value: "economique", label: "Économique" },
  { value: "informatique", label: "Informatique" },
  { value: "technique", label: "Technique" },
  { value: "sciences", label: "Sciences" },
  { value: "math", label: "Mathématiques" },
];

export default function UtilisateursPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as any)?.role === "super_admin";
  const [users, setUsers] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("ALL");
  const [classeFilter, setClasseFilter] = useState("ALL");
  const [filiereFilter, setFiliereFilter] = useState("ALL");
  const [etatFilter, setEtatFilter] = useState("ALL");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const [resetPwd, setResetPwd] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    motDePasse: "",
    telephone: "",
    role: "prof",
    niveau: "",
    classe: "",
    filiere: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/utilisateurs");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setFormData({ nom: "", prenom: "", email: "", motDePasse: "", telephone: "", role: "prof", niveau: "", classe: "", filiere: "" });
    setFormErrors({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.nom.trim()) newErrors.nom = "Requis";
    if (!formData.prenom.trim()) newErrors.prenom = "Requis";
    if (!formData.email.trim()) newErrors.email = "Requis";
    if (!formData.motDePasse || formData.motDePasse.length < 6) newErrors.motDePasse = "Min 6 caractères";
    if (formData.role === "eleve") {
      if (!formData.niveau) newErrors.niveau = "Requis";
      if (!formData.classe) newErrors.classe = "Requis";
      if (formData.niveau === "lycee" && ["2ème", "3ème", "Bac"].includes(formData.classe) && !formData.filiere) {
        newErrors.filiere = "Requise";
      }
    }
    if (Object.keys(newErrors).length > 0) { setFormErrors(newErrors); return; }

    try {
      setSubmitting(true);
      setError(null);
      const payload: any = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        motDePasse: formData.motDePasse,
        telephone: formData.telephone || null,
        role: formData.role,
      };
      if (formData.role === "eleve") {
        payload.niveau = formData.niveau;
        payload.classe = formData.classe;
        if (formData.filiere) payload.filiere = formData.filiere;
      }
      const res = await fetch("/api/admin/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la création");
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      setError(null);
      const res = await fetch(`/api/admin/utilisateurs?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la suppression");
      }
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwd) return;
    try {
      setResetSubmitting(true);
      setResetError(null);
      const res = await fetch("/api/admin/utilisateurs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetPwd.id, motDePasse: newPassword }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      setResetPwd(null);
      setNewPassword("");
      fetchUsers();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleToggleActif = async (id: string, currentActif: boolean) => {
    try {
      setTogglingId(id);
      setError(null);
      const res = await fetch("/api/admin/utilisateurs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, actif: !currentActif }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setTogglingId(null);
    }
  };

  const niveauLabels: Record<string, string> = { primaire: "Primaire", college: "Collège", lycee: "Lycée" };
  const filiereLabels: Record<string, string> = { lettres: "Lettres", economique: "Économique", informatique: "Informatique", technique: "Technique", sciences: "Sciences", math: "Mathématiques" };

  const handleDownloadExcel = () => {
    const headers = ["Code", "Nom", "Prénom", "Email", "Téléphone", "Niveau", "Classe", "Filière", "État"];
    const rows = filteredUsers
      .filter((u) => u.role === "eleve" || u.role === "ELEVE")
      .map((u) => [
        u.codeEleve || "",
        u.nom,
        u.prenom,
        u.email,
        u.telephone || "",
        niveauLabels[u.niveau || ""] || u.niveau || "",
        u.classe || "",
        filiereLabels[u.filiere || ""] || u.filiere || "",
        u.actif ? "Actif" : "Inactif",
      ]);

    const parts: string[] = [];
    if (niveauFilter !== "ALL") parts.push(`Niveau: ${niveauLabels[niveauFilter] || niveauFilter}`);
    if (classeFilter !== "ALL") parts.push(`Classe: ${classeFilter}`);
    if (filiereFilter !== "ALL") parts.push(`Filière: ${filiereLabels[filiereFilter] || filiereFilter}`);
    if (etatFilter !== "ALL") parts.push(`État: ${etatFilter}`);

    const csvContent = [
      ...(parts.length > 0 ? [`Filtres: ${parts.join(" | ")}`, `Total: ${rows.length} élèves`, ""] : []),
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filterName = parts.length > 0 ? `_${parts.map((p) => p.split(": ")[1]).join("_")}` : "_tous";
    a.download = `eleves${filterName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "ALL" || u.role.toUpperCase() === roleFilter;
    if (!matchesRole) return false;

    if (roleFilter === "ELEVE") {
      if (niveauFilter !== "ALL" && u.niveau !== niveauFilter) return false;
      if (classeFilter !== "ALL" && u.classe !== classeFilter) return false;
      if (filiereFilter !== "ALL" && u.filiere !== filiereFilter) return false;
      if (etatFilter !== "ALL" && ((etatFilter === "ACTIF" && !u.actif) || (etatFilter === "INACTIF" && u.actif))) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.codeEleve && u.codeEleve.toLowerCase().includes(q)) ||
      (u.codeProf && u.codeProf.toLowerCase().includes(q)) ||
      u.nom.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const availableClasses = niveauFilter !== "ALL" ? (classesByNiveau[niveauFilter] || []) : [];

  const roleLabel = (r: string) => {
    if (r === "admin" || r === "ADMIN") return "Admin";
    if (r === "prof" || r === "PROF") return "Prof";
    if (r === "eleve" || r === "ELEVE") return "Élève";
    return r;
  };

  const roleNav = (u: Utilisateur) => {
    if (u.role === "ELEVE" || u.role === "eleve") return `/admin/eleves/${u.id}`;
    if (u.role === "PROF" || u.role === "prof") return `/admin/professeurs/${u.id}`;
    return "#";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Gestion des Utilisateurs</h1>
        <button onClick={() => { setShowModal(true); resetForm(); }} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            <div className="flex gap-2">
              {["ALL", "ADMIN", "PROF", "ELEVE"].map((r) => (
                <button key={r} onClick={() => { setRoleFilter(r); setNiveauFilter("ALL"); setClasseFilter("ALL"); setFiliereFilter("ALL"); setEtatFilter("ALL"); }} className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${roleFilter === r ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-[#2a2d35] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-[#1e2128]"}`}>
                  {r === "ALL" ? "Tous" : r === "ELEVE" ? "Élèves" : r === "PROF" ? "Prof" : "Admins"}
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Rechercher par code, nom, prénom, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 pl-9 pr-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-neutral-400 dark:placeholder-neutral-500"
            />
          </div>
        </div>

        {roleFilter === "ELEVE" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-3 py-2">
            <span className="text-[12px] text-neutral-400 dark:text-neutral-500">Filtrer par :</span>
            <select value={niveauFilter} onChange={(e) => { setNiveauFilter(e.target.value); setClasseFilter("ALL"); }} className="rounded-md border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-2 py-1 focus:border-blue-500 focus:outline-none">
              <option value="ALL">Niveau</option>
              <option value="primaire">Primaire</option>
              <option value="college">Collège</option>
              <option value="lycee">Lycée</option>
            </select>
            {niveauFilter !== "ALL" && (
              <select value={classeFilter} onChange={(e) => setClasseFilter(e.target.value)} className="rounded-md border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-2 py-1 focus:border-blue-500 focus:outline-none">
                <option value="ALL">Classe</option>
                {availableClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className="rounded-md border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-2 py-1 focus:border-blue-500 focus:outline-none">
              <option value="ALL">Filière</option>
              <option value="lettres">Lettres</option>
              <option value="economique">Économique</option>
              <option value="informatique">Informatique</option>
              <option value="technique">Technique</option>
              <option value="sciences">Sciences</option>
              <option value="math">Mathématiques</option>
            </select>
            <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)} className="rounded-md border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-2 py-1 focus:border-blue-500 focus:outline-none">
              <option value="ALL">État</option>
              <option value="ACTIF">Actif</option>
              <option value="INACTIF">Inactif</option>
            </select>
            {(niveauFilter !== "ALL" || classeFilter !== "ALL" || filiereFilter !== "ALL" || etatFilter !== "ALL") && (
              <>
                <button onClick={() => { setNiveauFilter("ALL"); setClasseFilter("ALL"); setFiliereFilter("ALL"); setEtatFilter("ALL"); }} className="text-[13px] text-blue-600 dark:text-blue-400 hover:underline">Réinitialiser</button>
                <button onClick={handleDownloadExcel} className="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2 py-1 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128] ml-auto">
                  <Download className="h-3 w-3" /> Télécharger Excel ({filteredUsers.filter((u) => u.role === "eleve" || u.role === "ELEVE").length})
                </button>
              </>
            )}
            {!(niveauFilter !== "ALL" || classeFilter !== "ALL" || filiereFilter !== "ALL" || etatFilter !== "ALL") && (
              <button onClick={handleDownloadExcel} className="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] px-2 py-1 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128] ml-auto">
                <Download className="h-3 w-3" /> Télécharger tous ({filteredUsers.filter((u) => u.role === "eleve" || u.role === "ELEVE").length})
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22]">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 dark:border-[#2a2d35]">
              <tr>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Code</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Nom</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Email</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Rôle</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Classe</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">État</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-[#2a2d35]">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-2.5 text-center text-neutral-500 dark:text-neutral-400">Aucun utilisateur trouvé</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]" onClick={() => router.push(roleNav(user))}>
                    <td className="px-4 py-2.5">
                      {user.role === "eleve" || user.role === "ELEVE" ? (
                        <span className="inline-block rounded bg-blue-100 dark:bg-blue-900/20 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-400">{user.codeEleve || "—"}</span>
                      ) : user.role === "prof" || user.role === "PROF" ? (
                        <span className="inline-block rounded bg-emerald-100 dark:bg-emerald-900/20 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">{user.codeProf || "—"}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{user.prenom} {user.nom}</td>
                    <td className="px-4 py-2.5 text-[13px] text-neutral-900 dark:text-neutral-100">{user.email}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">{roleLabel(user.role)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                      {user.role === "eleve" || user.role === "ELEVE" ? (
                        <span>{user.classe || "—"}{user.filiere ? ` (${user.filiere})` : ""}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={(e) => { e.stopPropagation(); handleToggleActif(user.id, user.actif); }} disabled={togglingId === user.id} className="flex items-center gap-1 disabled:opacity-50" title={user.actif ? "Désactiver" : "Activer"}>
                        {togglingId === user.id ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400 dark:text-neutral-500" /> : user.actif ? <ToggleRight className="h-6 w-6 text-green-500 dark:text-green-400" /> : <ToggleLeft className="h-6 w-6 text-neutral-300 dark:text-[#2a2d35]" />}
                        <span className={`text-[11px] font-medium ${user.actif ? "text-green-600 dark:text-green-400" : "text-neutral-400 dark:text-neutral-500"}`}>{user.actif ? "Actif" : "Inactif"}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {isSuperAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); setResetPwd({ id: user.id, name: `${user.prenom} ${user.nom}` }); setNewPassword(""); setResetError(null); }} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" title="Réinitialiser le mot de passe">
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: user.id }); }} disabled={deletingId === user.id} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50">
                          {deletingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter un utilisateur</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Nom</label>
                <input value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {formErrors.nom && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.nom}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Prénom</label>
                <input value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {formErrors.prenom && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.prenom}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} type="email" className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {formErrors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.email}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Mot de passe</label>
                <PasswordInput value={formData.motDePasse} onChange={(e) => setFormData({ ...formData, motDePasse: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {formErrors.motDePasse && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.motDePasse}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Téléphone</label>
                <input value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Rôle</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value, niveau: "", classe: "", filiere: "" })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="admin">Admin</option>
                  <option value="prof">Prof</option>
                  <option value="eleve">Élève</option>
                </select>
              </div>

              {formData.role === "eleve" && (
                <>
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Niveau</label>
                    <select value={formData.niveau} onChange={(e) => setFormData({ ...formData, niveau: e.target.value, classe: "", filiere: "" })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="">-- Sélectionner --</option>
                      <option value="primaire">Primaire</option>
                      <option value="college">Collège</option>
                      <option value="lycee">Lycée</option>
                    </select>
                    {formErrors.niveau && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.niveau}</p>}
                  </div>
                  {formData.niveau && (
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Classe</label>
                      <select value={formData.classe} onChange={(e) => setFormData({ ...formData, classe: e.target.value, filiere: "" })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">-- Sélectionner --</option>
                        {(classesByNiveau[formData.niveau] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {formErrors.classe && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.classe}</p>}
                    </div>
                  )}
                  {formData.niveau === "lycee" && ["2ème", "3ème", "Bac"].includes(formData.classe) && (
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Filière</label>
                      <select value={formData.filiere} onChange={(e) => setFormData({ ...formData, filiere: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">-- Sélectionner --</option>
                        {filieres.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      {formErrors.filiere && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.filiere}</p>}
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]">Annuler</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDelete open={!!confirmDelete} title="Archiver l'utilisateur" message="L'utilisateur sera archivé : il ne pourra plus se connecter, mais toutes ses données (inscriptions, paiements, présences) seront conservées. Vous pourrez le réactiver à tout moment." onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete.id); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} loading={deletingId === confirmDelete?.id} />

      {resetPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Réinitialiser le mot de passe</h2>
              <button onClick={() => { setResetPwd(null); setNewPassword(""); }} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-4 text-[13px] text-neutral-600 dark:text-neutral-400">
              Définir un nouveau mot de passe pour <span className="font-semibold text-neutral-900 dark:text-neutral-100">{resetPwd.name}</span>. Communiquez-le lui ensuite.
            </p>
            {resetError && <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">{resetError}</div>}
            <div>
              <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Nouveau mot de passe (min 8 caractères)</label>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setResetPwd(null); setNewPassword(""); }} className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]">Annuler</button>
              <button onClick={handleResetPassword} disabled={resetSubmitting || newPassword.length < 8} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {resetSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
