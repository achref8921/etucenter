"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Loader2, Save, Edit3, Trash2, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { formatDate } from "@/lib/utils";
import ConfirmPermanentDelete from "@/components/confirm-permanent-delete";

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
        <div className="rounded-xl border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] p-6">
          {editing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Nom</label>
                  <input
                    {...register("nom", { required: "Le nom est requis", minLength: { value: 2, message: "Minimum 2 caractères" } })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.nom && (
                    <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{errors.nom.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Prénom</label>
                  <input
                    {...register("prenom", { required: "Le prénom est requis", minLength: { value: 2, message: "Minimum 2 caractères" } })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.prenom && (
                    <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">{errors.prenom.message}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  <Phone className="mr-1 inline h-3.5 w-3.5" /> Téléphone principal
                </label>
                <input
                  {...register("telephone")}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Niveau scolaire</label>
                <select
                  value={scolaire.niveau}
                  onChange={(e) => setScolaire({ niveau: e.target.value, classe: "", filiere: "" })}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {Object.entries(niveauLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Classe</label>
                <select
                  value={scolaire.classe}
                  onChange={(e) => setScolaire({ ...scolaire, classe: e.target.value, filiere: "" })}
                  disabled={!scolaire.niveau}
                  className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
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
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Filière</label>
                  <select
                    value={scolaire.filiere}
                    onChange={(e) => setScolaire({ ...scolaire, filiere: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="rounded-lg border border-neutral-200 dark:border-[#2a2d35] px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#1e2128]"
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
                  <dt className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Nom</dt>
                  <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.nom}</dd>
                </div>
                <div>
                  <dt className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Prénom</dt>
                  <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.prenom}</dd>
                </div>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Email</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.email}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Téléphone</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">{profil.telephone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Niveau scolaire</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">
                  {profil.niveau
                    ? `${niveauLabels[profil.niveau] ?? profil.niveau}${profil.classe ? ` — ${profil.classe}` : ""}${profil.filiere ? ` — ${filiereLabels[profil.filiere] ?? profil.filiere}` : ""}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Date de naissance</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">
                  {profil.dateNaissance ? formatDate(profil.dateNaissance) : "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#181b22] p-6">
        <h2 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
          <Trash2 className="mr-1 inline h-4 w-4" /> Zone Dangereuse
        </h2>
        <p className="mb-4 text-[13px] text-neutral-600 dark:text-neutral-400">
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
