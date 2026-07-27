"use client";

import { useEffect, useState } from "react";
import { User, Loader2, Save, Edit3, Lock, Mail, Phone, Calendar, Eye, EyeOff } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Profil {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: string;
  dateNaissance: string | null;
  createdAt: string;
}

export default function ProfilPage() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [ancienMotDePasse, setAncienMotDePasse] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmerMotDePasse, setConfirmerMotDePasse] = useState("");
  const [showAncien, setShowAncien] = useState(false);
  const [showNouveau, setShowNouveau] = useState(false);
  const [showConfirmer, setShowConfirmer] = useState(false);

  useEffect(() => {
    const fetchProfil = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/profil");
        if (!res.ok) throw new Error("Erreur lors du chargement");
        const data = await res.json();
        setProfil(data);
        setNom(data.nom);
        setPrenom(data.prenom);
        setEmail(data.email);
        setTelephone(data.telephone ?? "");
        setDateNaissance(data.dateNaissance ? data.dateNaissance.split("T")[0] : "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };
    fetchProfil();
  }, []);

  const handleSaveInfo = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          prenom,
          email,
          telephone: telephone || null,
          dateNaissance: dateNaissance || null,
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

  const handleChangePassword = async () => {
    try {
      setSaving(true);
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

      const res = await fetch("/api/profil", {
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
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mon Profil</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400">{success}</div>
      )}

      {profil && (
        <>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Informations Personnelles</h2>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Modifier
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setNom(profil.nom);
                      setPrenom(profil.prenom);
                      setEmail(profil.email);
                      setTelephone(profil.telephone ?? "");
                      setDateNaissance(profil.dateNaissance ? profil.dateNaissance.split("T")[0] : "");
                      setError(null);
                    }}
                    className="rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveInfo}
                    disabled={saving}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Sauvegarder
                  </button>
                </div>
              )}
            </div>
            <div className="p-6">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
                      <input
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Prénom</label>
                      <input
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Mail className="mr-1 inline h-3.5 w-3.5" /> Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Phone className="mr-1 inline h-3.5 w-3.5" /> Téléphone
                      </label>
                      <input
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Calendar className="mr-1 inline h-3.5 w-3.5" /> Date de naissance
                      </label>
                      <input
                        type="date"
                        value={dateNaissance}
                        onChange={(e) => setDateNaissance(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <dl className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nom</dt>
                      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{profil.nom}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Prénom</dt>
                      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{profil.prenom}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{profil.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Téléphone</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{profil.telephone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Date de naissance</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{profil.dateNaissance ? formatDate(profil.dateNaissance) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Membre depuis</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(profil.createdAt)}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Lock className="mr-1 inline h-4 w-4" /> Mot de Passe
              </h2>
              {!showPasswordSection ? (
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Changer le mot de passe
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowPasswordSection(false);
                    setAncienMotDePasse("");
                    setNouveauMotDePasse("");
                    setConfirmerMotDePasse("");
                    setError(null);
                  }}
                  className="rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
              )}
            </div>
            {showPasswordSection && (
              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Ancien mot de passe</label>
                  <div className="relative">
                    <input
                      type={showAncien ? "text" : "password"}
                      value={ancienMotDePasse}
                      onChange={(e) => setAncienMotDePasse(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAncien(!showAncien)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                    >
                      {showAncien ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showNouveau ? "text" : "password"}
                      value={nouveauMotDePasse}
                      onChange={(e) => setNouveauMotDePasse(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNouveau(!showNouveau)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                    >
                      {showNouveau ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirmer le mot de passe</label>
                  <div className="relative">
                    <input
                      type={showConfirmer ? "text" : "password"}
                      value={confirmerMotDePasse}
                      onChange={(e) => setConfirmerMotDePasse(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmer(!showConfirmer)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                    >
                      {showConfirmer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={saving}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Changer le mot de passe
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
