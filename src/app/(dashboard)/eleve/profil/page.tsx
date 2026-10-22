"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Loader2, Save, Edit3, Trash2, Phone, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { formatDate } from "@/lib/utils";
import ConfirmPermanentDelete from "@/components/confirm-permanent-delete";
import AvatarUpload from "@/components/avatar-upload";

interface Profil {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  niveau: string | null;
  classe: string | null;
  filiere: string | null;
  role: string;
  image: string | null;
  dateNaissance: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormInputs {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
}

const niveauLabels: Record<string, string> = {
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
};

const classesByNiveau: Record<string, string[]> = {
  primaire: ["CP", "CE1", "CE2", "CM1", "CM2"],
  college: ["7ème", "8ème", "9ème"],
  lycee: ["1ère", "2ème", "3ème", "Bac"],
};

const filieres = ["informatique", "maths", "economie", "lettres", "sciences"];

const filiereLabels: Record<string, string> = {
  informatique: "Informatique",
  maths: "Maths",
  economie: "Économie",
  lettres: "Lettres",
  sciences: "Sciences",
};

export default function EleveProfilPage() {
  const router = useRouter();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [ancienMotDePasse, setAncienMotDePasse] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmerMotDePasse, setConfirmerMotDePasse] = useState("");
  const [showAncien, setShowAncien] = useState(false);
  const [showNouveau, setShowNouveau] = useState(false);
  const [showConfirmer, setShowConfirmer] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInputs>();

  const [scolaire, setScolaire] = useState({ niveau: "", classe: "", filiere: "" });

  useEffect(() => {
    const fetchProfil = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/eleve/profil");
        if (!res.ok) throw new Error("Erreur lors du chargement du profil");
        const data = await res.json();
        setProfil(data);
        reset({
          nom: data.nom,
          prenom: data.prenom,
          telephone: data.telephone ?? "",
          email: data.email ?? "",
        });
        setScolaire({
          niveau: data.niveau ?? "",
          classe: data.classe ?? "",
          filiere: data.filiere ?? "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchProfil();
  }, [reset]);

  const onSubmit = async (data: FormInputs) => {
    if (scolaire.niveau && !scolaire.classe) {
      setError("Veuillez sélectionner votre classe");
      return;
    }
    const classesLycee = ["2ème", "3ème", "Bac"];
    if (scolaire.niveau === "lycee" && classesLycee.includes(scolaire.classe) && !scolaire.filiere) {
      setError("Veuillez sélectionner votre filière");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/eleve/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: data.nom,
          prenom: data.prenom,
          telephone: data.telephone || null,
          email: data.email.trim(),
          niveau: scolaire.niveau || null,
          classe: scolaire.classe || null,
          filiere: scolaire.filiere || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la mise à jour");
      }
      const updated = await res.json();
      setProfil(updated);
      reset({
        nom: updated.nom,
        prenom: updated.prenom,
        telephone: updated.telephone ?? "",
        email: updated.email ?? "",
      });
      setScolaire({
        niveau: updated.niveau ?? "",
        classe: updated.classe ?? "",
        filiere: updated.filiere ?? "",
      });
      setEditing(false);
      setSuccess("Profil mis à jour avec succès");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profil) {
      reset({
        nom: profil.nom,
        prenom: profil.prenom,
        telephone: profil.telephone ?? "",
        email: profil.email ?? "",
      });
      setScolaire({
        niveau: profil.niveau ?? "",
        classe: profil.classe ?? "",
        filiere: profil.filiere ?? "",
      });
    }
    setEditing(false);
    setError(null);
  };

  const handleChangePassword = async () => {
    try {
      setChangingPassword(true);
      setError(null);
      setSuccess(null);

      if (!ancienMotDePasse || !nouveauMotDePasse) {
        throw new Error("Tous les champs sont requis");
      }
      if (nouveauMotDePasse !== confirmerMotDePasse) {
        throw new Error("Les mots de passe ne correspondent pas");
      }
      if (nouveauMotDePasse.length < 6) {
        throw new Error("Le mot de passe doit contenir au moins 6 caractères");
      }

      const res = await fetch("/api/eleve/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motDePasse: nouveauMotDePasse,
          ancienMotDePasse,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors du changement de mot de passe");
      }

      setSuccess("Mot de passe changé avec succès");
      setAncienMotDePasse("");
      setNouveauMotDePasse("");
      setConfirmerMotDePasse("");
      setShowPasswordSection(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (password: string) => {
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      const res = await fetch("/api/profil/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasse: password }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la suppression");
      }
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mon Profil</h1>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
          >
            <Edit3 className="h-4 w-4" />
            Modifier
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-[13px] text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-[13px] text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {profil && (
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
          <div className="mb-6 border-b border-[var(--border)] pb-6">
            <AvatarUpload
              currentImage={profil.image}
              endpoint="/api/eleve/profil"
              onUpdated={(image) => setProfil((p) => (p ? { ...p, image } : p))}
            />
          </div>
          {editing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Nom</label>
                  <input
                    {...register("nom", { required: "Le nom est requis", minLength: { value: 2, message: "Minimum 2 caractères" } })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.nom && (
                    <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{errors.nom.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Prénom</label>
                  <input
                    {...register("prenom", { required: "Le prénom est requis", minLength: { value: 2, message: "Minimum 2 caractères" } })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.prenom && (
                    <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{errors.prenom.message}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">
                  <Mail className="mr-1 inline h-3.5 w-3.5" /> Email
                </label>
                <input
                  type="email"
                  {...register("email", {
                    required: "L'email est requis",
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email invalide" },
                  })}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.email && (
                  <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">
                  <Phone className="mr-1 inline h-3.5 w-3.5" /> Téléphone principal
                </label>
                <input
                  {...register("telephone")}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Niveau scolaire</label>
                <select
                  value={scolaire.niveau}
                  onChange={(e) => setScolaire({ niveau: e.target.value, classe: "", filiere: "" })}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {Object.entries(niveauLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Classe</label>
                <select
                  value={scolaire.classe}
                  onChange={(e) => setScolaire({ ...scolaire, classe: e.target.value, filiere: "" })}
                  disabled={!scolaire.niveau}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">-- Sélectionner --</option>
                  {scolaire.niveau &&
                    (classesByNiveau[scolaire.niveau] || []).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>
              </div>
              {scolaire.niveau === "lycee" && ["2ème", "3ème", "Bac"].includes(scolaire.classe) && (
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Filière</label>
                  <select
                    value={scolaire.filiere}
                    onChange={(e) => setScolaire({ ...scolaire, filiere: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Sélectionner --</option>
                    {filieres.map((f) => (
                      <option key={f} value={f}>{filiereLabels[f]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Sauvegarder
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[13px] font-medium text-[var(--foreground-faint)]">Nom</dt>
                  <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.nom}</dd>
                </div>
                <div>
                  <dt className="text-[13px] font-medium text-[var(--foreground-faint)]">Prénom</dt>
                  <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.prenom}</dd>
                </div>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-[var(--foreground-faint)]">Email</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.email}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-[var(--foreground-faint)]">Téléphone</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.telephone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-[var(--foreground-faint)]">Niveau scolaire</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">
                  {profil.niveau
                    ? `${niveauLabels[profil.niveau] ?? profil.niveau}${profil.classe ? ` — ${profil.classe}` : ""}${profil.filiere ? ` — ${filiereLabels[profil.filiere] ?? profil.filiere}` : ""}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-[var(--foreground-faint)]">Date de naissance</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">
                  {profil.dateNaissance ? formatDate(profil.dateNaissance) : "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Lock className="h-4 w-4 text-blue-600" /> Mot de passe
          </h2>
          {!showPasswordSection && (
            <button
              onClick={() => setShowPasswordSection(true)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
            >
              Changer le mot de passe
            </button>
          )}
        </div>
        {showPasswordSection && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Ancien mot de passe</label>
              <div className="relative">
                <input
                  type={showAncien ? "text" : "password"}
                  value={ancienMotDePasse}
                  onChange={(e) => setAncienMotDePasse(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowAncien(!showAncien)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  {showAncien ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNouveau ? "text" : "password"}
                  value={nouveauMotDePasse}
                  onChange={(e) => setNouveauMotDePasse(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNouveau(!showNouveau)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  {showNouveau ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[var(--foreground-subtle)]">Confirmer le nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirmer ? "text" : "password"}
                  value={confirmerMotDePasse}
                  onChange={(e) => setConfirmerMotDePasse(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmer(!showConfirmer)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  {showConfirmer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(false);
                  setAncienMotDePasse("");
                  setNouveauMotDePasse("");
                  setConfirmerMotDePasse("");
                }}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-[var(--surface)] p-6">
        <h2 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
          <Trash2 className="mr-1 inline h-4 w-4" /> Zone Dangereuse
        </h2>
        <p className="mb-4 text-[13px] text-[var(--foreground-subtle)]">
          La suppression de votre compte est <span className="font-semibold text-red-600 dark:text-red-400">irréversible</span>. Toutes vos données (inscriptions, paiements, présences, notifications) seront définitivement perdues.
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteError(null); }}
          className="rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-[13px] font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Supprimer mon compte
        </button>
      </div>

      <ConfirmPermanentDelete
        open={showDeleteModal}
        userName={profil ? `${profil.prenom} ${profil.nom}` : ""}
        onConfirm={handleDeleteAccount}
        onCancel={() => { setShowDeleteModal(false); setDeleteError(null); }}
        loading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
