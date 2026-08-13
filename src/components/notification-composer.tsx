"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Send, Search, Check, Eye, Bell, Users, X } from "lucide-react";

interface EleveOption {
  id: string;
  nom: string;
  prenom: string;
  codeEleve: string | null;
  classe: string | null;
  niveau: string | null;
}

export default function NotificationComposer({
  onSent,
}: {
  onSent?: () => void;
}) {
  const [eleves, setEleves] = useState<EleveOption[]>([]);
  const [loadingEleves, setLoadingEleves] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoadingEleves(true);
        const res = await fetch("/api/admin/eleves");
        if (res.ok) {
          const data = await res.json();
          setEleves(data);
        }
      } catch {
      } finally {
        setLoadingEleves(false);
      }
    })();
  }, []);

  const filteredEleves = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eleves;
    return eleves.filter(
      (e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
        (e.codeEleve || "").toLowerCase().includes(q) ||
        (e.classe || "").toLowerCase().includes(q)
    );
  }, [eleves, search]);

  const selectedEleves = eleves.filter((e) => selected.includes(e.id));

  const toggleSelect = (id: string) => {
    setSuccess(null);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    setSuccess(null);
    setSelected((prev) => {
      const next = new Set(prev);
      filteredEleves.forEach((e) => next.add(e.id));
      return [...next];
    });
  };

  const clearSelection = () => {
    setSelected([]);
    setSuccess(null);
  };

  const canSend = titre.trim().length >= 2 && message.trim().length >= 1 && selected.length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: titre.trim(),
          message: message.trim(),
          destinataires: selected,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Erreur lors de l'envoi");
      }
      setSuccess(`Notification envoyée à ${body.count} élève(s)`);
      setTitre("");
      setMessage("");
      setSelected([]);
      setShowPreview(false);
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-6 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Envoyer une notification aux élèves
        </h2>
      </div>

      <div className="p-6 space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-400">
            {success}
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Destinataires <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {selected.length} sélectionné(s)
            </span>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un élève par nom ou code..."
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {selectedEleves.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selectedEleves.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400"
                >
                  {e.prenom} {e.nom}
                  <button
                    onClick={() => toggleSelect(e.id)}
                    className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
                    title="Retirer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {loadingEleves ? (
            <div className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : filteredEleves.length === 0 ? (
            <div className="rounded-lg border border-gray-200 dark:border-slate-700 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Aucun élève trouvé
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700">
              <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2">
                <button
                  onClick={selectAllFiltered}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Tout sélectionner ({filteredEleves.length})
                </button>
                {selected.length > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
              {filteredEleves.map((e) => {
                const isSelected = selected.includes(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => toggleSelect(e.id)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-gray-50 dark:border-slate-700/50 px-3 py-2.5 text-left last:border-0 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {e.prenom} {e.nom}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {e.codeEleve ? `#${e.codeEleve}` : ""}
                        {e.classe ? ` · ${e.classe}` : ""}
                      </p>
                    </div>
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-300 dark:border-slate-600 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            maxLength={255}
            placeholder="Ex : Rappel de paiement, Séance annulée..."
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Écrivez le contenu de la notification..."
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {message.length}/2000
          </p>
        </div>

        {titre.trim() || message.trim() ? (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              <Eye className="h-3.5 w-3.5" />
              Aperçu
            </p>
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="mt-0.5 flex-shrink-0">
                <Bell className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {titre.trim() || "Titre de la notification"}
                  </p>
                  {!showPreview && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  {message.trim() || "Votre message apparaîtra ici pour les élèves sélectionnés."}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-1">
          <div className="mr-auto flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Users className="h-4 w-4" />
            {selected.length > 0 ? `${selected.length} élève(s) recevront cette notification` : "Aucun élève sélectionné"}
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "Masquer l'aperçu" : "Voir l'aperçu"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
