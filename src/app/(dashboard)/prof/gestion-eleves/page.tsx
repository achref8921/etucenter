"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Users, X, Trash2, GraduationCap, Search, UserPlus, UserX, KeyRound, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SkeletonPage } from "@/components/ui/skeleton";
import PasswordInput from "@/components/password-input";

interface Credentials {
  email: string;
  motDePasse: string;
  codeEleve: string;
}

interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  codeEleve: string | null;
  niveau: string | null;
  classe: string | null;
  filiere: string | null;
}

interface Inscription {
  id: string;
  dateInscription: string;
  eleve: Eleve;
}

interface GroupeGestion {
  id: string;
  nom: string;
  capaciteMax: number | null;
  matiere: { id: string; nom: string } | null;
  inscriptions: Inscription[];
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

const niveauLabels: Record<string, string> = { primaire: "Primaire", college: "Collège", lycee: "Lycée" };
const filiereLabels: Record<string, string> = { lettres: "Lettres", economique: "Économique", informatique: "Informatique", technique: "Technique", sciences: "Sciences", math: "Mathématiques" };

export default function ProfGestionElevesPage() {
  const { toast } = useToast();
  const [groupes, setGroupes] = useState<GroupeGestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createdCreds, setCreatedCreds] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    groupeId: "",
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    motDePasse: "",
    niveau: "",
    classe: "",
    filiere: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchGroupes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/prof/gestion-eleves");
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors du chargement");
      }
      const data = await res.json();
      setGroupes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroupes();
  }, [fetchGroupes]);

  const resetForm = () => {
    setFormData({ groupeId: "", nom: "", prenom: "", email: "", telephone: "", motDePasse: "", niveau: "", classe: "", filiere: "" });
    setFormErrors({});
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.groupeId) newErrors.groupeId = "Requis";
    if (!formData.nom.trim()) newErrors.nom = "Requis";
    if (!formData.prenom.trim()) newErrors.prenom = "Requis";
    if (formData.niveau && !formData.classe) newErrors.classe = "Requis";
    if (formData.motDePasse && formData.motDePasse.length < 6) newErrors.motDePasse = "Min 6 caractères";
    if (Object.keys(newErrors).length > 0) { setFormErrors(newErrors); return; }

    try {
      setSubmitting(true);
      setError(null);
      const payload: any = {
        groupeId: formData.groupeId,
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email || undefined,
        telephone: formData.telephone || undefined,
        motDePasse: formData.motDePasse || undefined,
        niveau: formData.niveau || undefined,
        classe: formData.classe || undefined,
        filiere: formData.filiere || undefined,
      };
      const res = await fetch("/api/prof/gestion-eleves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Erreur lors de la création");
      }
      setShowModal(false);
      resetForm();
      setCopied(false);
      if (body.credentials) {
        setCreatedCreds(body.credentials);
      } else {
        toast("success", `Élève ${body.eleve?.prenom} ${body.eleve?.nom} ajouté au groupe`);
      }
      fetchGroupes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (inscriptionId: string, eleveName: string) => {
    const label = `Retirer ${eleveName} du groupe ?`;
    const confirmed = window.confirm(`${label} L'élève restera dans les autres groupes du centre.`);
    if (!confirmed) return;
    try {
      setRemovingId(inscriptionId);
      setError(null);
      const res = await fetch(`/api/prof/gestion-eleves?id=${inscriptionId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Erreur lors du retrait");
      }
      toast("success", body.message || "Élève retiré du groupe");
      fetchGroupes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return <SkeletonPage />;
  }

  const totalEleves = groupes.reduce((acc, g) => acc + g.inscriptions.length, 0);

  const filteredGroupes = groupes.filter(
    (g) =>
      search === "" ||
      g.nom.toLowerCase().includes(search.toLowerCase()) ||
      g.inscriptions.some(
        (i) => `${i.eleve.prenom} ${i.eleve.nom}`.toLowerCase().includes(search.toLowerCase()) || (i.eleve.codeEleve && i.eleve.codeEleve.includes(search))
      )
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Gestion des Élèves</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Ajoutez de nouveaux élèves et inscrivez-les dans vos groupes
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" /> Ajouter un élève
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Vos Groupes</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{groupes.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Élèves inscrits</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalEleves}</p>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
        <input
          type="text"
          placeholder="Rechercher un groupe ou un élève..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Groups */}
      {filteredGroupes.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-12 text-center text-neutral-400 dark:text-neutral-500">
          {groupes.length === 0
            ? "Vous n'avez aucun groupe. Contactez l'administration du centre."
            : "Aucun résultat trouvé"}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroupes.map((g) => {
            const count = g.inscriptions.length;
            const capLabel = g.capaciteMax ? `${count}/${g.capaciteMax}` : `${count}`;
            const full = typeof g.capaciteMax === "number" && count >= g.capaciteMax;
            return (
              <div key={g.id} className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-neutral-100 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-200/60 dark:bg-neutral-800">
                      <GraduationCap className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{g.nom}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {g.matiere?.nom || "Sans matière"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      full
                        ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    }`}
                    title={g.capaciteMax ? "Nombre d'élèves / capacité maximale" : "Nombre d'élèves"}
                  >
                    <Users className="h-3.5 w-3.5" /> {capLabel}
                  </span>
                </div>

                {g.inscriptions.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <UserX className="mx-auto mb-2 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">
                      Aucun élève dans ce groupe. Cliquez sur « Ajouter un élève » pour inscrire.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {g.inscriptions.map((ins) => (
                      <li key={ins.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-neutral-100/50 dark:hover:bg-[#1e2128]">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 text-xs font-bold text-white">
                            {ins.eleve.prenom[0]}{ins.eleve.nom[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {ins.eleve.prenom} {ins.eleve.nom}
                            </p>
                            <p className="truncate text-xs text-neutral-400 dark:text-neutral-500">
                              {ins.eleve.codeEleve && <span className="font-mono">#{ins.eleve.codeEleve}</span>}
                              {ins.eleve.classe ? (
                                <>
                                  {" · "}
                                  {niveauLabels[ins.eleve.niveau || ""] || ins.eleve.niveau}
                                  {" — "}
                                  {ins.eleve.classe}
                                  {ins.eleve.filiere ? ` (${filiereLabels[ins.eleve.filiere] || ins.eleve.filiere})` : ""}
                                </>
                              ) : (
                                " · Niveau non renseigné"
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(ins.id, `${ins.eleve.prenom} ${ins.eleve.nom}`)}
                          disabled={removingId === ins.id}
                          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                          title="Retirer du groupe"
                        >
                          {removingId === ins.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          <span className="hidden sm:inline">Retirer</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Ajouter un élève</h2>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Groupe</label>
                <select
                  value={formData.groupeId}
                  onChange={(e) => setFormData({ ...formData, groupeId: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner un groupe --</option>
                  {groupes.map((g) => {
                    const count = g.inscriptions.length;
                    const full = typeof g.capaciteMax === "number" && count >= g.capaciteMax;
                    return (
                      <option key={g.id} value={g.id} disabled={full}>
                        {g.nom} ({count}{g.capaciteMax ? `/${g.capaciteMax}` : ""}){full ? " — complet" : ""}
                      </option>
                    );
                  })}
                </select>
                {formErrors.groupeId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.groupeId}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Prénom *</label>
                  <input value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {formErrors.prenom && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.prenom}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Nom *</label>
                  <input value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {formErrors.nom && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.nom}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Téléphone</label>
                <input value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Email (optionnel)</label>
                <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} type="email" className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Mot de passe initial <span className="text-neutral-400 dark:text-neutral-500">(optionnel — généré automatiquement si vide)</span>
                </label>
                <PasswordInput value={formData.motDePasse} onChange={(e) => setFormData({ ...formData, motDePasse: e.target.value })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {formErrors.motDePasse && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.motDePasse}</p>}
                <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                  Minimum 6 caractères. L'élève pourra se connecter avec son email et ce mot de passe.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Niveau</label>
                <select value={formData.niveau} onChange={(e) => setFormData({ ...formData, niveau: e.target.value, classe: "", filiere: "" })} className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-[13px] text-neutral-900 dark:text-neutral-100 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">-- Sélectionner --</option>
                  <option value="primaire">Primaire</option>
                  <option value="college">Collège</option>
                  <option value="lycee">Lycée</option>
                </select>
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
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]">Annuler</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Insérer au groupe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials modal */}
      {createdCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Élève créé avec succès</h2>
              <button onClick={() => setCreatedCreds(null)} className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-[13px] text-emerald-700 dark:text-emerald-400">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Communiquez ces informations à l'élève pour qu'il puisse se connecter à son compte.
              </span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Code élève</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">#{createdCreds.codeEleve}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Email / Identifiant</p>
                <p className="mt-0.5 break-all text-sm font-medium text-neutral-900 dark:text-neutral-100">{createdCreds.email}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-neutral-50 dark:bg-[#1e2128] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Mot de passe initial</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">{createdCreds.motDePasse}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `Code: ${createdCreds.codeEleve}\nEmail: ${createdCreds.email}\nMot de passe: ${createdCreds.motDePasse}`
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copié !" : "Copier les identifiants"}
              </button>
              <button onClick={() => setCreatedCreds(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}