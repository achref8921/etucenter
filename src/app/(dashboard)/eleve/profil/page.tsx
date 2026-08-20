"use client";

import { useEffect, useState } from "react";
import { User, Loader2, Save, Edit3 } from "lucide-react";
import { useForm } from "react-hook-form";
import { formatDate } from "@/lib/utils";

interface Profil {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
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

export default function EleveProfilPage() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInputs>();

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchProfil();
  }, [reset]);

  const onSubmit = async (data: FormInputs) => {
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
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur lors de la mise à jour");
      }
      const updated = await res.json();
      setProfil(updated);
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
    }
    setEditing(false);
    setError(null);
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    Téléphone
                  </label>
                  <input
                    {...register("telephone")}
                    className="w-full rounded-lg border border-neutral-200 dark:border-[#2a2d35] bg-white dark:bg-[#181b22] text-gray-900 dark:text-gray-100 px-3 py-2 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
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
                <dt className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Date de naissance</dt>
                <dd className="mt-1 text-[13px] text-gray-900 dark:text-gray-100">
                  {profil.dateNaissance ? formatDate(profil.dateNaissance) : "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
