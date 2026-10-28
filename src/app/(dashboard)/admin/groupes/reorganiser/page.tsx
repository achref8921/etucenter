"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Layers,
  Loader2,
  Merge,
  Plus,
  Scissors,
  Users,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface EleveGroupe {
  eleveId: string;
  inscriptionId: string;
  nom: string;
  prenom: string;
  codeEleve: string | null;
  classe: string | null;
  forfaitMontant: number | null;
  forfaitSeances: number | null;
  dateInscription: string;
}

interface GroupeData {
  id: string;
  nom: string;
  statut: "actif" | "archive";
  profId: string | null;
  prof: { id: string; nom: string; prenom: string } | null;
  matiereId: string | null;
  matiere: { id: string; nom: string } | null;
  prixParSeance: number;
  forfaitMontant: number | null;
  forfaitSeances: number | null;
  capaciteMax: number | null;
  eleves: EleveGroupe[];
  stats: {
    seances: number;
    seancesFutures: number;
    paiements: number;
    paiementsMontant: number;
  };
}

interface Prof {
  id: string;
  nom: string;
  prenom: string;
}

interface Matiere {
  id: string;
  nom: string;
}

interface TargetState {
  key: string;
  mode: "new" | "existing";
  groupeId: string;
  nom: string;
  profId: string;
  matiereId: string;
  tarifMode: "seance" | "forfait";
  prixParSeance: string;
  forfaitMontant: string;
  forfaitSeances: string;
  capaciteMax: string;
  planningFrom: string;
}

interface RepartitionResult {
  effectDate: string;
  elevesDeplaces: number;
  sources: {
    groupeId: string;
    nom: string;
    deplaces: number;
    restants: number;
    archive: boolean;
    historiqueAbsorbe: boolean;
    seancesDeplacees: number;
    paiementsDeplaces: number;
    seancesFuturesAnnulees: number;
  }[];
  targets: {
    key: string;
    groupeId: string;
    nom: string;
    nouveau: boolean;
    eleves: number;
    seancesCopiees: number;
  }[];
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "mb-1 block text-[12px] font-medium text-[var(--foreground-subtle)]";

function newTargetKey() {
  return `t_${Math.random().toString(36).slice(2, 9)}`;
}

function ReorganiserGroupesContent() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupes, setGroupes] = useState<GroupeData[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [today, setToday] = useState("");

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [targets, setTargets] = useState<TargetState[]>([]);
  const [assignment, setAssignment] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RepartitionResult | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch("/api/admin/groupes/repartition");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors du chargement des groupes");
      }
      const data = await res.json();
      setGroupes(data.groupes ?? []);
      setProfs(data.profs ?? []);
      setMatieres(data.matieres ?? []);
      setToday(data.today ?? "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeGroupes = useMemo(() => groupes.filter((g) => g.statut === "actif"), [groupes]);
  const groupeById = useMemo(() => new Map(groupes.map((g) => [g.id, g])), [groupes]);

  const sourceGroups = useMemo(
    () => selectedSourceIds.map((id) => groupeById.get(id)).filter((g): g is GroupeData => !!g),
    [selectedSourceIds, groupeById]
  );

  const students = useMemo(
    () =>
      sourceGroups.flatMap((g) =>
        g.eleves.map((e) => ({
          ...e,
          sourceGroupeId: g.id,
          sourceNom: g.nom,
          sourceProfId: g.profId,
        }))
      ),
    [sourceGroups]
  );

  const targetLabel = useCallback(
    (target: TargetState) => {
      if (target.mode === "existing") {
        const g = groupeById.get(target.groupeId);
        return g ? `Groupe existant · ${g.nom}` : "Groupe existant (non choisi)";
      }
      return target.nom.trim() || "Nouveau groupe sans nom";
    },
    [groupeById]
  );

  const targetProfId = useCallback(
    (target: TargetState) => {
      if (target.mode === "existing") return groupeById.get(target.groupeId)?.profId ?? null;
      return target.profId || null;
    },
    [groupeById]
  );

  // ─── Sélection des groupes d'origine ───────────────────────────────────────
  const toggleSource = (groupeId: string) => {
    setSelectedSourceIds((prev) => {
      if (prev.includes(groupeId)) {
        setAssignment((current) => {
          const next = { ...current };
          for (const eleve of groupeById.get(groupeId)?.eleves ?? []) {
            delete next[eleve.eleveId];
          }
          return next;
        });
        return prev.filter((id) => id !== groupeId);
      }
      return [...prev, groupeId];
    });
  };

  // ─── Groupes cibles ────────────────────────────────────────────────────────
  const addTarget = (init?: Partial<TargetState>) => {
    const key = newTargetKey();
    setTargets((prev) => [
      ...prev,
      {
        key,
        mode: "new",
        groupeId: "",
        nom: "",
        profId: "",
        matiereId: "",
        tarifMode: "seance",
        prixParSeance: "",
        forfaitMontant: "",
        forfaitSeances: "",
        capaciteMax: "",
        planningFrom: "",
        ...init,
      },
    ]);
    return key;
  };

  const updateTarget = (key: string, patch: Partial<TargetState>) => {
    setTargets((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  };

  const removeTarget = (key: string) => {
    setTargets((prev) => prev.filter((t) => t.key !== key));
    setAssignment((current) => {
      const next = { ...current };
      for (const [eleveId, targetKey] of Object.entries(next)) {
        if (targetKey === key) delete next[eleveId];
      }
      return next;
    });
  };

  const assign = (eleveId: string, targetKey: string) => {
    setAssignment((current) => {
      const next = { ...current };
      if (!targetKey) delete next[eleveId];
      else next[eleveId] = targetKey;
      return next;
    });
  };

  const assignAllOfSource = (sourceGroupeId: string, targetKey: string) => {
    setAssignment((current) => {
      const next = { ...current };
      for (const eleve of students) {
        if (eleve.sourceGroupeId !== sourceGroupeId) continue;
        if (!targetKey) delete next[eleve.eleveId];
        else next[eleve.eleveId] = targetKey;
      }
      return next;
    });
  };

  /** Scinde un groupe d'origine en `parts` groupes cibles équilibrés. */
  const splitSource = (source: GroupeData, parts: number) => {
    const existingKeys = targets
      .filter((t) => t.planningFrom === source.id && t.mode === "new")
      .map((t) => t.key);
    if (existingKeys.length > 0) {
      removeTargetsForSource(source.id);
    }

    const created: string[] = [];
    for (let index = 0; index < parts; index += 1) {
      created.push(
        addTarget({
          nom: `${source.nom} · ${LETTERS[index] ?? index + 1}`,
          profId: source.profId ?? "",
          matiereId: source.matiereId ?? "",
          tarifMode: source.forfaitMontant && source.forfaitSeances ? "forfait" : "seance",
          prixParSeance: String(source.prixParSeance ?? ""),
          forfaitMontant: source.forfaitMontant != null ? String(source.forfaitMontant) : "",
          forfaitSeances: source.forfaitSeances != null ? String(source.forfaitSeances) : "",
          capaciteMax: source.capaciteMax != null ? String(source.capaciteMax) : "",
          planningFrom: source.id,
        })
      );
    }

    setAssignment((current) => {
      const next = { ...current };
      source.eleves.forEach((eleve, index) => {
        next[eleve.eleveId] = created[index % parts];
      });
      return next;
    });
  };

  const removeTargetsForSource = (sourceGroupeId: string) => {
    const keys = targets.filter((t) => t.planningFrom === sourceGroupeId).map((t) => t.key);
    if (keys.length === 0) return;
    setTargets((prev) => prev.filter((t) => !keys.includes(t.key)));
    setAssignment((current) => {
      const next = { ...current };
      for (const [eleveId, key] of Object.entries(next)) {
        if (keys.includes(key)) delete next[eleveId];
      }
      return next;
    });
  };

  const mergeAll = () => {
    if (sourceGroups.length === 0) return;
    const first = sourceGroups[0];
    const key = addTarget({
      nom:
        sourceGroups.length === 1
          ? `${first.nom} · regroupé`
          : `${first.nom} + ${sourceGroups.length - 1} groupe${sourceGroups.length > 2 ? "s" : ""}`,
      profId: first.profId ?? "",
      matiereId: first.matiereId ?? "",
      tarifMode: first.forfaitMontant && first.forfaitSeances ? "forfait" : "seance",
      prixParSeance: String(first.prixParSeance ?? ""),
      forfaitMontant: first.forfaitMontant != null ? String(first.forfaitMontant) : "",
      forfaitSeances: first.forfaitSeances != null ? String(first.forfaitSeances) : "",
      capaciteMax: first.capaciteMax != null ? String(first.capaciteMax) : "",
      planningFrom: first.id,
    });
    setAssignment((current) => {
      const next = { ...current };
      for (const eleve of students) next[eleve.eleveId] = key;
      return next;
    });
  };

  const mergeSelectionIntoNewGroup = () => {
    const key = addTarget({ nom: "" });
    setAssignment((current) => {
      const next = { ...current };
      for (const eleve of students) next[eleve.eleveId] = key;
      return next;
    });
  };

  // ─── Aperçu ────────────────────────────────────────────────────────────────
  const targetById = useMemo(() => new Map(targets.map((t) => [t.key, t])), [targets]);

  const assignedByTarget = useMemo(() => {
    const map = new Map<string, typeof students>();
    for (const target of targets) map.set(target.key, []);
    for (const eleve of students) {
      const key = assignment[eleve.eleveId];
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(eleve);
    }
    return map;
  }, [students, assignment, targets]);

  const unassigned = useMemo(
    () => students.filter((s) => !assignment[s.eleveId]),
    [students, assignment]
  );

  const preview = useMemo(() => {
    return sourceGroups.map((groupe) => {
      const moved = students.filter(
        (s) => s.sourceGroupeId === groupe.id && !!assignment[s.eleveId]
      );
      const remaining = groupe.eleves.length - moved.length;
      const targetKeys = [...new Set(moved.map((s) => assignment[s.eleveId]))];
      const target = targetKeys.length === 1 ? targetById.get(targetKeys[0]) ?? null : null;
      const sameProf =
        target !== null && (targetProfId(target) ?? null) === (groupe.profId ?? null);
      const absorb =
        remaining === 0 && targetKeys.length === 1 && sameProf && !!target;
      return {
        groupe,
        moved: moved.length,
        remaining,
        archive: remaining === 0 && moved.length > 0,
        absorb,
        target,
      };
    });
  }, [sourceGroups, students, assignment, targetById, targetProfId]);

  const absorptions = preview.filter((p) => p.absorb);
  const passwordRequired = absorptions.length > 0;

  const usedTargets = useMemo(
    () => targets.filter((t) => (assignedByTarget.get(t.key) ?? []).length > 0),
    [targets, assignedByTarget]
  );

  const warnings = useMemo(() => {
    const list: { tone: "warning" | "info" | "error"; text: string }[] = [];
    if (targets.length === 0) {
      list.push({
        tone: "info",
        text: "Ajoutez au moins un groupe cible (ou utilisez « Scinder » / « Tout regrouper »).",
      });
    }
    for (const target of targets) {
      const count = (assignedByTarget.get(target.key) ?? []).length;
      if (count === 0) {
        list.push({ tone: "info", text: `Le groupe cible « ${targetLabel(target)} » est vide : il sera ignoré.` });
      }
      if (target.mode === "new" && target.nom.trim().length < 2 && count > 0) {
        list.push({ tone: "error", text: "Un groupe cible utilisé n'a pas de nom." });
      }
      if (
        target.mode === "new" &&
        count > 0 &&
        (target.tarifMode === "seance"
          ? !(Number(target.prixParSeance) > 0)
          : !(Number(target.forfaitMontant) > 0 && Number(target.forfaitSeances) > 0))
      ) {
        list.push({ tone: "error", text: `Le tarif du groupe « ${targetLabel(target)} » est incomplet.` });
      }
      if (target.mode === "existing" && !target.groupeId) {
        list.push({ tone: "error", text: "Un groupe cible « existant » n'est pas sélectionné." });
      }
      if (target.capaciteMax && Number(target.capaciteMax) > 0 && count > Number(target.capaciteMax)) {
        list.push({
          tone: "warning",
          text: `« ${targetLabel(target)} » dépassera sa capacité (${count}/${target.capaciteMax}). Les élèves restent inscrits, mais aucune nouvelle inscription ne sera acceptée.`,
        });
      }
    }
    if (unassigned.length > 0) {
      list.push({
        tone: "info",
        text: `${unassigned.length} élève(s) non assigné(s) resteront dans leur groupe d'origine.`,
      });
    }
    for (const item of preview) {
      if (item.moved > 0 && item.remaining === 0 && !item.absorb && item.target) {
        list.push({
          tone: "warning",
          text: `« ${item.groupe.nom} » sera vidé : son historique (${item.groupe.stats.seances} séance(s), ${item.groupe.stats.paiements} paiement(s)) reste sur ce groupe archivé${
            (targetProfId(item.target) ?? null) !== (item.groupe.profId ?? null)
              ? " car le professeur change"
              : ""
          }.`,
        });
      }
    }
    return list;
  }, [targets, assignedByTarget, targetLabel, unassigned.length, preview, targetProfId]);

  const canSubmit =
    usedTargets.length > 0 &&
    !warnings.some((w) => w.tone === "error") &&
    students.length > 0 &&
    !submitting;

  // ─── Soumission ────────────────────────────────────────────────────────────
  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payloadTargets = usedTargets.map((target) => {
        const eleves = (assignedByTarget.get(target.key) ?? []).map((e) => ({
          eleveId: e.eleveId,
          sourceGroupeId: e.sourceGroupeId,
        }));
        const base: Record<string, unknown> = {
          key: target.key,
          planningFromGroupeId: target.planningFrom || null,
          eleves,
        };
        if (target.mode === "existing") {
          base.groupeId = target.groupeId;
        } else {
          base.nom = target.nom.trim();
          base.profId = target.profId || null;
          base.matiereId = target.matiereId || null;
          base.capaciteMax = target.capaciteMax ? Number(target.capaciteMax) : null;
          if (target.tarifMode === "forfait") {
            base.forfaitMontant = Number(target.forfaitMontant);
            base.forfaitSeances = Number(target.forfaitSeances);
          } else {
            base.prixParSeance = Number(target.prixParSeance);
          }
        }
        return base;
      });

      const res = await fetch("/api/admin/groupes/repartition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: payloadTargets,
          fusionnerHistorique: true,
          archiverSourcesVides: true,
          motDePasse: motDePasse || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Erreur lors de la réorganisation");
      }

      setResult(body as RepartitionResult);
      setConfirmOpen(false);
      setMotDePasse("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Pré-remplissage depuis les raccourcis (?groupes=...&mode=split&parts=2) ─
  useEffect(() => {
    if (loading || groupes.length === 0) return;
    const raw = searchParams.get("groupes");
    if (!raw) return;
    const ids = raw.split(",").map((s) => s.trim()).filter((id) => groupeById.has(id));
    if (ids.length === 0) return;

    const mode = searchParams.get("mode");
    const parts = Math.min(4, Math.max(2, Number(searchParams.get("parts") ?? "2") || 2));

    setSelectedSourceIds(ids);

    if (mode === "split" && ids.length === 1) {
      const source = groupeById.get(ids[0]);
      if (source) splitSource(source, parts);
    } else {
      const sources = ids.map((id) => groupeById.get(id)).filter((g): g is GroupeData => !!g);
      if (sources.length > 0) {
        const first = sources[0];
        const key = addTarget({
          nom: sources.length === 1 ? `${first.nom} · regroupé` : `${first.nom} + ${sources.length - 1} groupe${sources.length > 2 ? "s" : ""}`,
          profId: first.profId ?? "",
          matiereId: first.matiereId ?? "",
          tarifMode: first.forfaitMontant && first.forfaitSeances ? "forfait" : "seance",
          prixParSeance: String(first.prixParSeance ?? ""),
          forfaitMontant: first.forfaitMontant != null ? String(first.forfaitMontant) : "",
          forfaitSeances: first.forfaitSeances != null ? String(first.forfaitSeances) : "",
          capaciteMax: first.capaciteMax != null ? String(first.capaciteMax) : "",
          planningFrom: first.id,
        });
        setAssignment((current) => {
          const next = { ...current };
          for (const source of sources) {
            for (const eleve of source.eleves) next[eleve.eleveId] = key;
          }
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, groupes.length]);

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
        {loadError}
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-[20px] border border-green-200 bg-green-50 p-6 dark:border-green-900/50 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <h1 className="text-lg font-semibold text-green-800 dark:text-green-300">
                Réorganisation appliquée
              </h1>
              <p className="text-[13px] text-green-700 dark:text-green-400">
                {result.elevesDeplaces} élève(s) déplacé(s) le {result.effectDate}. Aucun montant
                n&apos;a été modifié : paiements, soldes et consommations sont intacts.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Groupe</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Élèves</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]">Séances copiées</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-faint)]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.targets.map((target) => (
                <tr key={target.key}>
                  <td className="px-4 py-2.5 font-medium">
                    {target.nom}
                    {target.nouveau && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        nouveau
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[13px]">{target.eleves}</td>
                  <td className="px-4 py-2.5 text-[13px]">{target.seancesCopiees}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/admin/groupes/${target.groupeId}`}
                      className="text-[13px] text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.sources.length > 0 && (
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-3 text-sm font-semibold">Groupes d&apos;origine</h2>
            <ul className="space-y-2 text-[13px] text-[var(--foreground-subtle)]">
              {result.sources.map((source) => (
                <li key={source.groupeId} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--foreground)]">{source.nom}</span>
                  <span>· {source.deplaces} déplacé(s)</span>
                  <span>· {source.restants} restant(s)</span>
                  {source.archive && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      archivé
                    </span>
                  )}
                  {source.historiqueAbsorbe && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      historique transféré ({source.seancesDeplacees} séances, {source.paiementsDeplaces} paiements)
                    </span>
                  )}
                  {source.seancesFuturesAnnulees > 0 && (
                    <span>· {source.seancesFuturesAnnulees} séance(s) future(s) annulée(s)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/groupes"
            className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
          >
            Retour aux groupes
          </Link>
          <button
            onClick={() => {
              setResult(null);
              setSelectedSourceIds([]);
              setTargets([]);
              setAssignment({});
              load();
            }}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Nouvelle opération
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/groupes"
            className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-[var(--foreground-faint)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Groupes
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Scinder / Fusionner des groupes
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-[var(--foreground-subtle)]">
            Déplacez des élèves d&apos;un groupe à un autre sans toucher à l&apos;argent : les
            paiements, les soldes et les consommations restent attachés à chaque élève. Les
            séances passées et l&apos;historique de chaque groupe sont conservés.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* 1. Groupes d'origine */}
          <section className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">1. Groupes d&apos;origine</h2>
                <p className="text-[12px] text-[var(--foreground-faint)]">
                  Sélectionnez un ou plusieurs groupes à réorganiser.
                </p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {selectedSourceIds.length} sélectionné(s)
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {activeGroupes.map((groupe) => {
                const selected = selectedSourceIds.includes(groupe.id);
                return (
                  <div
                    key={groupe.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/10"
                        : "border-[var(--border)] hover:border-neutral-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSource(groupe.id)}
                        className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[var(--foreground)]">
                          {groupe.nom}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--foreground-faint)]">
                          {groupe.prof ? `${groupe.prof.prenom} ${groupe.prof.nom}` : "Sans professeur"}
                          {" · "}
                          {groupe.eleves.length} élève(s)
                          {" · "}
                          {formatCurrency(groupe.prixParSeance)}/séance
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1 text-[10px] text-[var(--foreground-faint)]">
                          {groupe.stats.seancesFutures > 0 && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                              {groupe.stats.seancesFutures} séance(s) à venir
                            </span>
                          )}
                          {groupe.stats.paiements > 0 && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                              {groupe.stats.paiements} paiement(s)
                            </span>
                          )}
                        </span>
                      </span>
                    </label>

                    {selected && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2">
                        {[2, 3, 4].map((parts) => (
                          <button
                            key={parts}
                            onClick={() => splitSource(groupe, parts)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--foreground-subtle)] hover:bg-neutral-50 dark:hover:bg-neutral-800"
                            title={`Créer ${parts} groupes à partir de ${groupe.nom}`}
                          >
                            <Scissors className="h-3 w-3" />
                            Scinder en {parts}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {activeGroupes.length === 0 && (
              <p className="text-[13px] text-[var(--foreground-faint)]">
                Aucun groupe actif. Créez d&apos;abord des groupes.
              </p>
            )}
          </section>

          {/* 2. Répartition */}
          {students.length > 0 && (
            <section className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">2. Répartition des élèves</h2>
                  <p className="text-[12px] text-[var(--foreground-faint)]">
                    Choisissez le groupe cible de chaque élève. Un élève non assigné reste dans son
                    groupe d&apos;origine.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={mergeAll}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Merge className="h-3.5 w-3.5" />
                    Tout regrouper
                  </button>
                  <button
                    onClick={() => addTarget()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Groupe cible
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {sourceGroups.map((groupe) => {
                  const rows = students.filter((s) => s.sourceGroupeId === groupe.id);
                  return (
                    <div key={groupe.id}>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                          {groupe.nom} · {rows.length} élève(s)
                        </h3>
                        {targets.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => assignAllOfSource(groupe.id, e.target.value)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--foreground-subtle)]"
                          >
                            <option value="">Tout assigner à…</option>
                            {targets.map((target) => (
                              <option key={target.key} value={target.key}>
                                {targetLabel(target)}
                              </option>
                            ))}
                            <option value="__none__">— retirer l&apos;assignation</option>
                          </select>
                        )}
                      </div>

                      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                        <table className="w-full text-left text-[13px]">
                          <tbody className="divide-y divide-[var(--border)]">
                            {rows.map((eleve) => (
                              <tr key={`${eleve.sourceGroupeId}-${eleve.eleveId}`}>
                                <td className="px-3 py-2">
                                  <span className="font-medium text-[var(--foreground)]">
                                    {eleve.prenom} {eleve.nom}
                                  </span>
                                  <span className="ml-2 text-[11px] text-[var(--foreground-faint)]">
                                    {eleve.codeEleve ? `#${eleve.codeEleve}` : ""}
                                    {eleve.forfaitMontant && eleve.forfaitSeances
                                      ? ` · forfait ${formatCurrency(eleve.forfaitMontant)} / ${eleve.forfaitSeances} séances`
                                      : ""}
                                  </span>
                                </td>
                                <td className="w-[240px] px-3 py-2">
                                  <select
                                    value={assignment[eleve.eleveId] ?? ""}
                                    onChange={(e) =>
                                      assign(
                                        eleve.eleveId,
                                        e.target.value === "__none__" ? "" : e.target.value
                                      )
                                    }
                                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--foreground)]"
                                  >
                                    <option value="">Rester dans {groupe.nom}</option>
                                    {targets.map((target) => (
                                      <option key={target.key} value={target.key}>
                                        → {targetLabel(target)}
                                      </option>
                                    ))}
                                    <option value="__none__">— retirer l&apos;assignation</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. Groupes cibles */}
          {targets.length > 0 && (
            <section className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">3. Groupes cibles</h2>
                  <p className="text-[12px] text-[var(--foreground-faint)]">
                    Un groupe cible peut être nouveau ou déjà existant.
                  </p>
                </div>
                <button
                  onClick={() => addTarget()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </div>

              <div className="space-y-3">
                {targets.map((target) => {
                  const count = (assignedByTarget.get(target.key) ?? []).length;
                  return (
                    <div
                      key={target.key}
                      className={`rounded-xl border p-3 ${
                        count === 0
                          ? "border-dashed border-[var(--border)] opacity-70"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Users className="h-3 w-3" />
                            {count}
                          </span>
                          <span className="text-[12px] font-medium text-[var(--foreground)]">
                            {targetLabel(target)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeTarget(target.key)}
                          className="text-[var(--foreground-faint)] hover:text-red-600"
                          title="Supprimer ce groupe cible"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Type</label>
                          <select
                            value={target.mode}
                            onChange={(e) =>
                              updateTarget(target.key, {
                                mode: e.target.value as "new" | "existing",
                              })
                            }
                            className={inputClass}
                          >
                            <option value="new">Nouveau groupe</option>
                            <option value="existing">Groupe existant</option>
                          </select>
                        </div>

                        {target.mode === "existing" ? (
                          <div>
                            <label className={labelClass}>Groupe</label>
                            <select
                              value={target.groupeId}
                              onChange={(e) => updateTarget(target.key, { groupeId: e.target.value })}
                              className={inputClass}
                            >
                              <option value="">— choisir —</option>
                              {activeGroupes
                                .filter((g) => !selectedSourceIds.includes(g.id))
                                .map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.nom} ({g.eleves.length})
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className={labelClass}>Nom</label>
                            <input
                              value={target.nom}
                              onChange={(e) => updateTarget(target.key, { nom: e.target.value })}
                              className={inputClass}
                              placeholder="ex. Bac Info 1 · A"
                            />
                          </div>
                        )}

                        {target.mode === "new" && (
                          <>
                            <div>
                              <label className={labelClass}>Professeur</label>
                              <select
                                value={target.profId}
                                onChange={(e) => updateTarget(target.key, { profId: e.target.value })}
                                className={inputClass}
                              >
                                <option value="">— aucun —</option>
                                {profs.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.prenom} {p.nom}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>Matière</label>
                              <select
                                value={target.matiereId}
                                onChange={(e) => updateTarget(target.key, { matiereId: e.target.value })}
                                className={inputClass}
                              >
                                <option value="">— aucune —</option>
                                {matieres.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nom}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>Tarification</label>
                              <select
                                value={target.tarifMode}
                                onChange={(e) =>
                                  updateTarget(target.key, {
                                    tarifMode: e.target.value as "seance" | "forfait",
                                  })
                                }
                                className={inputClass}
                              >
                                <option value="seance">Prix par séance</option>
                                <option value="forfait">Forfait</option>
                              </select>
                            </div>
                            {target.tarifMode === "seance" ? (
                              <div>
                                <label className={labelClass}>Prix / séance (DT)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={target.prixParSeance}
                                  onChange={(e) =>
                                    updateTarget(target.key, { prixParSeance: e.target.value })
                                  }
                                  className={inputClass}
                                />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={labelClass}>Montant (DT)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={target.forfaitMontant}
                                    onChange={(e) =>
                                      updateTarget(target.key, { forfaitMontant: e.target.value })
                                    }
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className={labelClass}>Nb séances</label>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={target.forfaitSeances}
                                    onChange={(e) =>
                                      updateTarget(target.key, { forfaitSeances: e.target.value })
                                    }
                                    className={inputClass}
                                  />
                                </div>
                              </div>
                            )}
                            <div>
                              <label className={labelClass}>Capacité max</label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={target.capaciteMax}
                                onChange={(e) =>
                                  updateTarget(target.key, { capaciteMax: e.target.value })
                                }
                                className={inputClass}
                                placeholder="illimitée"
                              />
                            </div>
                          </>
                        )}

                        <div className="sm:col-span-2">
                          <label className={labelClass}>Planning des séances futures</label>
                          <select
                            value={target.planningFrom}
                            onChange={(e) => updateTarget(target.key, { planningFrom: e.target.value })}
                            className={inputClass}
                          >
                            <option value="">Ne rien copier (aucune séance planifiée)</option>
                            {sourceGroups
                              .filter((g) => g.id !== target.groupeId)
                              .map((g) => (
                                <option key={g.id} value={g.id}>
                                  Copier les séances futures de « {g.nom} » ({g.stats.seancesFutures})
                                </option>
                              ))}
                          </select>
                          <p className="mt-1 text-[11px] text-[var(--foreground-faint)]">
                            Les copies sont des séances planifiées vides (aucune présence, aucun
                            montant) : chaque groupe reste indépendant.
                          </p>
                        </div>
                      </div>

                      {count > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(assignedByTarget.get(target.key) ?? []).map((eleve) => (
                            <span
                              key={`${eleve.sourceGroupeId}-${eleve.eleveId}`}
                              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-[var(--foreground-subtle)] dark:bg-neutral-800"
                            >
                              {eleve.prenom} {eleve.nom}
                              <button
                                onClick={() => assign(eleve.eleveId, "")}
                                className="text-[var(--foreground-faint)] hover:text-red-600"
                                title="Retirer de ce groupe cible"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Aperçu */}
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <Layers className="h-4 w-4" />
              Aperçu
            </h2>

            {students.length === 0 ? (
              <p className="text-[12px] text-[var(--foreground-faint)]">
                Sélectionnez un groupe d&apos;origine pour commencer.
              </p>
            ) : (
              <div className="space-y-3">
                {preview.map((item) => (
                  <div key={item.groupe.id} className="rounded-xl border border-[var(--border)] p-2.5">
                    <p className="text-[12px] font-medium text-[var(--foreground)]">{item.groupe.nom}</p>
                    <p className="text-[11px] text-[var(--foreground-subtle)]">
                      {item.moved} déplacé(s) · {item.remaining} restant(s)
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.archive && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          sera archivé
                        </span>
                      )}
                      {item.absorb && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          historique transféré
                        </span>
                      )}
                      {item.archive && !item.absorb && item.groupe.stats.seances > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          historique conservé
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="rounded-xl border border-[var(--border)] p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                    Groupes cibles
                  </p>
                  {usedTargets.length === 0 ? (
                    <p className="mt-1 text-[11px] text-[var(--foreground-faint)]">Aucun élève assigné.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {usedTargets.map((target) => (
                        <li key={target.key} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-[var(--foreground)]">{targetLabel(target)}</span>
                          <span className="shrink-0 text-[var(--foreground-faint)]">
                            {(assignedByTarget.get(target.key) ?? []).length} élève(s)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {warnings.map((warning, index) => (
                  <li
                    key={index}
                    className={`flex items-start gap-1.5 text-[11px] ${
                      warning.tone === "error"
                        ? "text-red-600 dark:text-red-400"
                        : warning.tone === "warning"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-[var(--foreground-faint)]"
                    }`}
                  >
                    {warning.tone === "info" ? (
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    )}
                    <span>{warning.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {passwordRequired && (
              <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-2.5 text-[11px] text-purple-800 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-300">
                L&apos;historique de {absorptions.length} groupe(s) sera déplacé vers le groupe
                cible (séances et paiements). Votre mot de passe sera demandé.
              </div>
            )}

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Appliquer la réorganisation
            </button>
            <p className="mt-2 text-center text-[11px] text-[var(--foreground-faint)]">
              Aucun paiement, solde ou consommation ne sera modifié.
            </p>
          </div>
        </aside>
      </div>

      {/* Confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Confirmer la réorganisation</h2>
                <p className="text-[12px] text-[var(--foreground-subtle)]">
                  Date d&apos;effet : {today}. Opération immédiate.
                </p>
              </div>
              <button
                onClick={() => setConfirmOpen(false)}
                className="text-[var(--foreground-faint)] hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--border)] p-3 text-[12px]">
              {preview
                .filter((item) => item.moved > 0)
                .map((item) => (
                  <p key={item.groupe.id} className="text-[var(--foreground-subtle)]">
                    <span className="font-medium text-[var(--foreground)]">{item.groupe.nom}</span>
                    {" : "}
                    {item.moved} élève(s) déplacé(s) →{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {item.target ? targetLabel(item.target) : "plusieurs groupes"}
                    </span>
                    {item.archive ? " · groupe archivé" : ""}
                    {item.absorb ? " · historique transféré" : ""}
                  </p>
                ))}
            </div>

            {passwordRequired && (
              <div className="mt-3">
                <label className={labelClass}>Votre mot de passe (obligatoire)</label>
                <input
                  type="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                />
                <p className="mt-1 text-[11px] text-[var(--foreground-faint)]">
                  Requis car des séances et des paiements changent de groupe.
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={submitting || (passwordRequired && motDePasse.length < 1)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReorganiserGroupesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ReorganiserGroupesContent />
    </Suspense>
  );
}
