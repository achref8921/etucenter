"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Trash2, X, Loader2, Filter, ToggleLeft, ToggleRight, Search, Download, KeyRound, UserCog, Users, GraduationCap, ShieldCheck } from "lucide-react";
import PasswordInput from "@/components/password-input";
import ConfirmDelete from "@/components/confirm-delete";
import ConfirmGhostDelete, { GhostImpactData } from "@/components/confirm-ghost-delete";
import UserAvatar from "@/components/user-avatar";
import {
  Badge,
  Card,
  EmptyState,
  MetricCard,
  PageHeader,
  Table,
  THead,
  TH,
  TR,
  TD,
} from "@/components/ui";

interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: string;
  actif: boolean;
  ghost?: boolean;
  peutGererEleves: boolean;
  peutEncaisserReverse: boolean;
  codeEleve: string | null;
  codeProf: string | null;
  niveau: string | null;
  classe: string | null;
  filiere: string | null;
  hasImage?: boolean;
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

interface GroupeOption {
  id: string;
  nom: string;
  matiere: { id: string; nom: string } | null;
  prof: { id: string; nom: string; prenom: string } | null;
  eleveIds: string[];
}

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
  const [groupeFilter, setGroupeFilter] = useState("ALL");
  const [groupes, setGroupes] = useState<GroupeOption[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const [ghostTarget, setGhostTarget] = useState<{ id: string; prenom: string; nom: string } | null>(null);
  const [ghostImpact, setGhostImpact] = useState<GhostImpactData | null>(null);
  const [ghostSubmitting, setGhostSubmitting] = useState(false);
  const [ghostError, setGhostError] = useState<string | null>(null);
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
  const [modalError, setModalError] = useState<string | null>(null);

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
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/admin/groupes");
      if (!res.ok) return;
      const data = (await res.json()) as any[];
      setGroupes(
        data.map((g) => ({
          id: g.id,
          nom: g.nom,
          matiere: g.matiere ?? null,
          prof: g.prof ?? null,
          eleveIds: (g.inscriptions ?? []).map((i: any) => i.eleveId as string),
        }))
      );
    } catch {
      /* silencieux : le filtre groupes ne s'affiche pas si indisponible */
    }
  };

  const resetForm = () => {
    setFormData({ nom: "", prenom: "", email: "", motDePasse: "", telephone: "", role: "prof", niveau: "", classe: "", filiere: "" });
    setFormErrors({});
    setModalError(null);
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
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setFormErrors({ ...formErrors, email: body.error || "Un utilisateur avec cet email existe déjà" });
          setModalError(body.error || "Un utilisateur avec cet email existe déjà");
        } else {
          setModalError(body.error || "Erreur lors de la création");
        }
        return;
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

  const handleGhostDeleteOpen = async (user: Utilisateur) => {
    setGhostError(null);
    setGhostImpact(null);
    setGhostTarget({ id: user.id, prenom: user.prenom, nom: user.nom });
    try {
      const res = await fetch(`/api/admin/utilisateurs/${user.id}/ghost`, { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Impossible de charger l'impact");
      }
      const data = await res.json();
      setGhostImpact(data.impact as GhostImpactData);
    } catch (err) {
      setGhostError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const handleGhostDeleteConfirm = async (id: string, motDePasse: string) => {
    try {
      setGhostSubmitting(true);
      setGhostError(null);
      const res = await fetch(`/api/admin/utilisateurs/${id}/ghost`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasse }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Erreur lors de la suppression définitive");
      }
      setGhostTarget(null);
      setGhostImpact(null);
      fetchUsers();
    } catch (err) {
      setGhostError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGhostSubmitting(false);
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

  const [gestionTogglingId, setGestionTogglingId] = useState<string | null>(null);

  const handleToggleGestionEleves = async (id: string, current: boolean) => {
    try {
      setGestionTogglingId(id);
      setError(null);
      const res = await fetch("/api/admin/utilisateurs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, peutGererEleves: !current }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setGestionTogglingId(null);
    }
  };

  const [reverseTogglingId, setReverseTogglingId] = useState<string | null>(null);

  const handleToggleEncaisserReverse = async (id: string, current: boolean) => {
    try {
      setReverseTogglingId(id);
      setError(null);
      const res = await fetch("/api/admin/utilisateurs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, peutEncaisserReverse: !current }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur");
      }
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setReverseTogglingId(null);
    }
  };

  const niveauLabels: Record<string, string> = { primaire: "Primaire", college: "Collège", lycee: "Lycée" };  const filiereLabels: Record<string, string> = { lettres: "Lettres", economique: "Économique", informatique: "Informatique", technique: "Technique", sciences: "Sciences", math: "Mathématiques" };

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
    if (groupeFilter !== "ALL") {
      const g = groupes.find((x) => x.id === groupeFilter);
      if (g) parts.push(`Groupe: ${g.nom}${g.prof ? ` (${g.prof.prenom} ${g.prof.nom})` : ""}`);
    }

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

  const roleStats = {
    eleves: users.filter((u) => u.role === "eleve" || u.role === "ELEVE").length,
    profs: users.filter((u) => u.role === "prof" || u.role === "PROF").length,
    admins: users.filter((u) => u.role === "admin" || u.role === "ADMIN").length,
    inactifs: users.filter((u) => !u.actif && !u.ghost).length,
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "ALL" || u.role.toUpperCase() === roleFilter;
    if (!matchesRole) return false;

    if (roleFilter === "ELEVE") {
      if (niveauFilter !== "ALL" && u.niveau !== niveauFilter) return false;
      if (classeFilter !== "ALL" && u.classe !== classeFilter) return false;
      if (filiereFilter !== "ALL" && u.filiere !== filiereFilter) return false;
      if (groupeFilter !== "ALL") {
        const g = groupes.find((x) => x.id === groupeFilter);
        if (!g || !g.eleveIds.includes(u.id)) return false;
      }
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
    if (u.ghost) return "#";
    if (u.role === "ELEVE" || u.role === "eleve") return `/admin/eleves/${u.id}`;
    if (u.role === "PROF" || u.role === "prof") return `/admin/professeurs/${u.id}`;
    return "#";
  };

  return (
    <div className="space-y-[var(--space-section-y)]">
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérez les comptes, les rôles et les permissions du centre"
        actions={
          <button
            onClick={() => { setShowModal(true); resetForm(); }}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--primary)] px-3.5 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-xs transition-[filter] hover:brightness-[0.94]"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <MetricCard
            className="h-full"
            label="Utilisateurs"
            value={users.length}
            currency={false}
            sub={`${roleStats.inactifs} inactif${roleStats.inactifs > 1 ? "s" : ""}`}
            icon={Users}
            tone="primary"
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          <MetricCard
            className="h-full"
            label="Élèves"
            value={roleStats.eleves}
            currency={false}
            sub="inscrits au centre"
            icon={GraduationCap}
            tone="success"
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <MetricCard
            className="h-full"
            label="Professeurs"
            value={roleStats.profs}
            currency={false}
            sub="équipe pédagogique"
            icon={UserCog}
            tone="warning"
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "240ms" }}>
          <MetricCard
            className="h-full"
            label="Administrateurs"
            value={roleStats.admins}
            currency={false}
            sub="gestion du centre"
            icon={ShieldCheck}
            tone="neutral"
          />
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--foreground-faint)]">
                <Filter className="h-3.5 w-3.5" /> Rôle
              </span>
              <div className="flex flex-wrap gap-1.5">
                {["ALL", "ADMIN", "PROF", "ELEVE"].map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRoleFilter(r); setNiveauFilter("ALL"); setClasseFilter("ALL"); setFiliereFilter("ALL"); setGroupeFilter("ALL"); }}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${roleFilter === r ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs" : "bg-[var(--surface-muted)] text-[var(--foreground-subtle)] hover:bg-[var(--border)]"}`}
                  >
                    {r === "ALL" ? "Tous" : r === "ELEVE" ? "Élèves" : r === "PROF" ? "Prof" : "Admins"}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-faint)]" />
              <input
                type="text"
                placeholder="Rechercher par code, nom, prénom, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-[13px] text-[var(--foreground)] placeholder-neutral-400 focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30 dark:placeholder-neutral-500"
              />
            </div>
          </div>

          {roleFilter === "ELEVE" && (
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2.5">
              <span className="text-[12px] font-medium text-[var(--foreground-faint)]">Filtrer par :</span>
              <select value={niveauFilter} onChange={(e) => { setNiveauFilter(e.target.value); setClasseFilter("ALL"); }} className="h-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none">
                <option value="ALL">Niveau</option>
                <option value="primaire">Primaire</option>
                <option value="college">Collège</option>
                <option value="lycee">Lycée</option>
              </select>
              {niveauFilter !== "ALL" && (
                <select value={classeFilter} onChange={(e) => setClasseFilter(e.target.value)} className="h-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none">
                  <option value="ALL">Classe</option>
                  {availableClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className="h-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none">
                <option value="ALL">Filière</option>
                <option value="lettres">Lettres</option>
                <option value="economique">Économique</option>
                <option value="informatique">Informatique</option>
                <option value="technique">Technique</option>
                <option value="sciences">Sciences</option>
                <option value="math">Mathématiques</option>
              </select>
              <select value={groupeFilter} onChange={(e) => setGroupeFilter(e.target.value)} className="h-8 max-w-[240px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none">
                <option value="ALL">Groupe</option>
                {groupes.map((g) => (
                  <option key={g.id} value={g.id}>{g.nom}{g.matiere ? ` — ${g.matiere.nom}` : ""}{g.prof ? ` · ${g.prof.prenom} ${g.prof.nom}` : ""}</option>
                ))}
              </select>
              {groupeFilter !== "ALL" && (() => {
                const g = groupes.find((x) => x.id === groupeFilter);
                return g ? (
                  <Badge variant="primary">
                    {g.eleveIds.length} élève{g.eleveIds.length > 1 ? "s" : ""}
                    {g.prof ? ` · Prof : ${g.prof.prenom} ${g.prof.nom}` : ""}
                  </Badge>
                ) : null;
              })()}
              {(niveauFilter !== "ALL" || classeFilter !== "ALL" || filiereFilter !== "ALL" || groupeFilter !== "ALL") && (
                <button onClick={() => { setNiveauFilter("ALL"); setClasseFilter("ALL"); setFiliereFilter("ALL"); setGroupeFilter("ALL"); }} className="text-[12px] font-semibold text-[var(--primary)] hover:underline">Réinitialiser</button>
              )}
              <button onClick={handleDownloadExcel} className="ml-auto flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]">
                <Download className="h-3.5 w-3.5" /> Télécharger Excel ({filteredUsers.filter((u) => u.role === "eleve" || u.role === "ELEVE").length})
              </button>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-[13px] text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
              Liste des utilisateurs
            </h2>
            <Badge variant="primary">{filteredUsers.length}</Badge>
          </div>
          <p className="text-[12px] text-[var(--foreground-faint)]">
            Cliquez sur une ligne pour ouvrir la fiche
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="Aucun utilisateur trouvé"
              description="Modifiez les filtres ou la recherche pour afficher des comptes."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Code</TH>
                  <TH>Utilisateur</TH>
                  <TH>Rôle</TH>
                  <TH>Classe</TH>
                  <TH>État</TH>
                  <TH>Gestion élèves</TH>
                  <TH>Encaisser</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredUsers.map((user) => (
                  <TR
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => {
                      const href = roleNav(user);
                      if (href !== "#") router.push(href);
                    }}
                  >
                    <TD>
                      {user.role === "eleve" || user.role === "ELEVE" ? (
                        <Badge variant="primary" className="font-mono">{user.codeEleve || "—"}</Badge>
                      ) : user.role === "prof" || user.role === "PROF" ? (
                        <Badge variant="success" className="font-mono">{user.codeProf || "—"}</Badge>
                      ) : (
                        <span className="text-[var(--foreground-faint)]">—</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <UserAvatar userId={user.id} nom={user.nom} prenom={user.prenom} hasImage={user.hasImage} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[var(--foreground)]">
                            {user.prenom} {user.nom}
                          </p>
                          <p className="truncate text-[11px] text-[var(--foreground-faint)]">{user.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge
                        variant={
                          user.role === "admin" || user.role === "ADMIN"
                            ? "primary"
                            : user.role === "prof" || user.role === "PROF"
                              ? "success"
                              : "info"
                        }
                      >
                        {roleLabel(user.role)}
                      </Badge>
                    </TD>
                    <TD className="text-[12px] text-[var(--foreground-faint)]">
                      {user.role === "eleve" || user.role === "ELEVE" ? (
                        <span>{user.classe || "—"}{user.filiere ? ` (${user.filiere})` : ""}</span>
                      ) : "—"}
                    </TD>
                    <TD>
                      {user.ghost ? (
                        <Badge variant="error" title="Compte supprimé par son titulaire, données conservées pour l'administration">
                          <Trash2 className="h-3 w-3" />
                          Compte supprimé
                        </Badge>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleToggleActif(user.id, user.actif); }} disabled={togglingId === user.id} className="flex items-center gap-1 disabled:opacity-50" title={user.actif ? "Désactiver" : "Activer"}>
                          {togglingId === user.id ? <Loader2 className="h-4 w-4 animate-spin text-[var(--foreground-faint)]" /> : user.actif ? <ToggleRight className="h-6 w-6 text-emerald-500 dark:text-emerald-400" /> : <ToggleLeft className="h-6 w-6 text-[var(--foreground-faint)]" />}
                          <span className={`text-[11px] font-medium ${user.actif ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--foreground-faint)]"}`}>{user.actif ? "Actif" : "Inactif"}</span>
                        </button>
                      )}
                    </TD>
                    <TD>
                      {user.role === "prof" || user.role === "PROF" ? (
                        <button onClick={(e) => { e.stopPropagation(); handleToggleGestionEleves(user.id, user.peutGererEleves); }} disabled={gestionTogglingId === user.id} className="flex items-center gap-1 disabled:opacity-50" title={user.peutGererEleves ? "Retirer la permission de gérer des élèves" : "Autoriser la gestion des élèves"}>
                          {gestionTogglingId === user.id ? <Loader2 className="h-4 w-4 animate-spin text-[var(--foreground-faint)]" /> : user.peutGererEleves ? <ToggleRight className="h-6 w-6 text-blue-600 dark:text-blue-400" /> : <ToggleLeft className="h-6 w-6 text-[var(--foreground-faint)]" />}
                          <span className={`text-[11px] font-medium ${user.peutGererEleves ? "text-blue-700 dark:text-blue-400" : "text-[var(--foreground-faint)]"}`}>{user.peutGererEleves ? "Oui" : "Non"}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--foreground-faint)]">—</span>
                      )}
                    </TD>
                    <TD>
                      {user.role === "prof" || user.role === "PROF" ? (
                        <button onClick={(e) => { e.stopPropagation(); handleToggleEncaisserReverse(user.id, user.peutEncaisserReverse); }} disabled={reverseTogglingId === user.id} className="flex items-center gap-1 disabled:opacity-50" title={user.peutEncaisserReverse ? "Désactiver la collecte inverse" : "Autoriser la collecte inverse"}>
                          {reverseTogglingId === user.id ? <Loader2 className="h-4 w-4 animate-spin text-[var(--foreground-faint)]" /> : user.peutEncaisserReverse ? <ToggleRight className="h-6 w-6 text-emerald-500 dark:text-emerald-400" /> : <ToggleLeft className="h-6 w-6 text-[var(--foreground-faint)]" />}
                          <span className={`text-[11px] font-medium ${user.peutEncaisserReverse ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--foreground-faint)]"}`}>{user.peutEncaisserReverse ? "Oui" : "Non"}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--foreground-faint)]">—</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        {!user.ghost && isSuperAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); setResetPwd({ id: user.id, name: `${user.prenom} ${user.nom}` }); setNewPassword(""); setResetError(null); }} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10" title="Réinitialiser le mot de passe" aria-label="Réinitialiser le mot de passe">
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}
                        {user.ghost ? (
                          <button onClick={(e) => { e.stopPropagation(); handleGhostDeleteOpen(user); }} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" title="Effacer définitivement le compte et toutes ses données" aria-label="Effacer définitivement le compte">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: user.id }); }} disabled={deletingId === user.id} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10" aria-label="Supprimer l'utilisateur">
                            {deletingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold">Ajouter un utilisateur</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-[var(--foreground-faint)] hover:text-neutral-600 dark:hover:text-neutral-300"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
                {modalError && (
                  <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-400">
                    <span>{modalError}</span>
                    <button type="button" onClick={() => setModalError(null)} className="text-red-500 hover:text-red-700 dark:hover:text-red-300" aria-label="Fermer">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Nom</label>
                  <input value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {formErrors.nom && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.nom}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Prénom</label>
                  <input value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {formErrors.prenom && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.prenom}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Email</label>
                  <input value={formData.email} onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (formErrors.email) { const next = { ...formErrors }; delete next.email; setFormErrors(next); } }} type="email" className={`w-full rounded-lg border ${formErrors.email ? "border-red-500" : "border-neutral-200 dark:border-[#2a2d35]"} bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`} />
                  {formErrors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Mot de passe</label>
                  <PasswordInput value={formData.motDePasse} onChange={(e) => setFormData({ ...formData, motDePasse: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {formErrors.motDePasse && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.motDePasse}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Téléphone</label>
                  <input value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Rôle</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value, niveau: "", classe: "", filiere: "" })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="admin">Admin</option>
                    <option value="prof">Prof</option>
                    <option value="eleve">Élève</option>
                  </select>
                </div>

                {formData.role === "eleve" && (
                  <>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Niveau</label>
                      <select value={formData.niveau} onChange={(e) => setFormData({ ...formData, niveau: e.target.value, classe: "", filiere: "" })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">-- Sélectionner --</option>
                        <option value="primaire">Primaire</option>
                        <option value="college">Collège</option>
                        <option value="lycee">Lycée</option>
                      </select>
                      {formErrors.niveau && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.niveau}</p>}
                    </div>
                    {formData.niveau && (
                      <div>
                        <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Classe</label>
                        <select value={formData.classe} onChange={(e) => setFormData({ ...formData, classe: e.target.value, filiere: "" })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="">-- Sélectionner --</option>
                          {(classesByNiveau[formData.niveau] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {formErrors.classe && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.classe}</p>}
                      </div>
                    )}
                    {formData.niveau === "lycee" && ["2ème", "3ème", "Bac"].includes(formData.classe) && (
                      <div>
                        <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Filière</label>
                        <select value={formData.filiere} onChange={(e) => setFormData({ ...formData, filiere: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="">-- Sélectionner --</option>
                          {filieres.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        {formErrors.filiere && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.filiere}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]">Annuler</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmGhostDelete open={!!ghostTarget} user={ghostTarget} impact={ghostImpact} error={ghostError} loading={ghostSubmitting} onConfirm={handleGhostDeleteConfirm} onCancel={() => { setGhostTarget(null); setGhostImpact(null); setGhostError(null); }} />
      <ConfirmDelete open={!!confirmDelete} title="Archiver l'utilisateur" message="L'utilisateur sera archivé : il ne pourra plus se connecter, mais toutes ses données (inscriptions, paiements, présences) seront conservées. Vous pourrez le réactiver à tout moment." onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete.id); setConfirmDelete(null); }} onCancel={() => setConfirmDelete(null)} loading={deletingId === confirmDelete?.id} />

      {resetPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Réinitialiser le mot de passe</h2>
              <button onClick={() => { setResetPwd(null); setNewPassword(""); }} className="text-[var(--foreground-faint)] hover:text-neutral-600 dark:hover:text-neutral-300"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-4 text-[13px] text-[var(--foreground-subtle)]">
              Définir un nouveau mot de passe pour <span className="font-semibold text-[var(--foreground)]">{resetPwd.name}</span>. Communiquez-le lui ensuite.
            </p>
            {resetError && <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">{resetError}</div>}
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Nouveau mot de passe (min 8 caractères)</label>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--foreground)] px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setResetPwd(null); setNewPassword(""); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]">Annuler</button>
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
