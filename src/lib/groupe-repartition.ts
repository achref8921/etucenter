import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendPushToUsers } from "@/lib/push";
import { todayDateInputValue } from "@/lib/utils";

/**
 * Réorganisation des groupes : scission, fusion, déplacement d'élèves.
 *
 * Principe : on ne déplace QUE des périodes d'inscription. Aucune ligne
 * financière (paiement, consommation, gain professeur, dette centre) n'est
 * créée, recalculée ou supprimée par une simple réorganisation.
 *
 * Historique :
 *   - Une scission laisse l'historique (séances passées, paiements) sur le
 *     groupe d'origine, archivé s'il est vidé. Les nouveaux groupes démarrent à
 *     la date de l'opération et reçoivent une COPIE des séances futures
 *     planifiées, sans présence : chacun est ensuite totalement indépendant.
 *   - Une fusion qui absorbe entièrement un groupe (0 élève restant) vers un
 *     seul groupe cible, avec le même professeur, déplace l'historique complet
 *     (séances + paiements) vers la cible. Les présences suivent leur séance et
 *     le prix de chaque séance déplacée est figé : aucun montant ne change.
 *   - Si les professeurs diffèrent, l'historique reste dans le groupe
 *     d'origine : les gains d'un professeur ne sont jamais réattribués.
 */

export class RepartitionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RepartitionError";
    this.status = status;
  }
}

export interface RepartitionMove {
  eleveId: string;
  sourceGroupeId: string;
}

export interface RepartitionTargetInput {
  key: string;
  groupeId?: string | null;
  nom?: string | null;
  profId?: string | null;
  matiereId?: string | null;
  prixParSeance?: number | null;
  forfaitMontant?: number | null;
  forfaitSeances?: number | null;
  capaciteMax?: number | null;
  planningFromGroupeId?: string | null;
  eleves: RepartitionMove[];
}

export interface RepartitionInput {
  targets: RepartitionTargetInput[];
  fusionnerHistorique?: boolean;
  archiverSourcesVides?: boolean;
  motDePasse?: string | null;
}

export interface RepartitionSourceSummary {
  groupeId: string;
  nom: string;
  deplaces: number;
  restants: number;
  archive: boolean;
  historiqueAbsorbe: boolean;
  seancesDeplacees: number;
  paiementsDeplaces: number;
  seancesFuturesAnnulees: number;
}

export interface RepartitionTargetSummary {
  key: string;
  groupeId: string;
  nom: string;
  nouveau: boolean;
  eleves: number;
  seancesCopiees: number;
}

export interface RepartitionResult {
  effectDate: string;
  elevesDeplaces: number;
  sources: RepartitionSourceSummary[];
  targets: RepartitionTargetSummary[];
}

const ARCHIVE_MOTIF_PREFIX = "Réorganisation des groupes";

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function effectivePrice(target: {
  prixParSeance?: number | null;
  forfaitMontant?: number | null;
  forfaitSeances?: number | null;
}): number {
  if (target.forfaitMontant && target.forfaitSeances) {
    return round2(target.forfaitMontant / target.forfaitSeances);
  }
  return round2(Number(target.prixParSeance ?? 0));
}

interface PlannedGroup {
  key: string;
  groupeId: string | null;
  nom: string;
  profId: string | null;
  matiereId: string | null;
  prixParSeance: number;
  forfaitMontant: number | null;
  forfaitSeances: number | null;
  capaciteMax: number | null;
  planningFromGroupeId: string | null;
  isNew: boolean;
  /** eleveId -> groupes d'origine (un élève peut venir de 2 groupes à la fois) */
  eleves: Map<string, string[]>;
}

async function buildPlan(
  tx: Prisma.TransactionClient,
  centerId: string,
  input: RepartitionInput
) {
  const targetKeys = new Set<string>();
  const eleveTarget = new Map<string, string>();

  const planned: PlannedGroup[] = input.targets.map((target) => {
    if (targetKeys.has(target.key)) {
      throw new RepartitionError("Deux groupes cibles portent la même référence interne");
    }
    targetKeys.add(target.key);

    const eleves = new Map<string, string[]>();
    for (const move of target.eleves) {
      const existingTarget = eleveTarget.get(move.eleveId);
      if (existingTarget) {
        throw new RepartitionError(
          "Un élève ne peut pas être placé dans deux groupes cibles différents"
        );
      }
      eleveTarget.set(move.eleveId, target.key);
      const sources = eleves.get(move.eleveId) ?? [];
      if (!sources.includes(move.sourceGroupeId)) sources.push(move.sourceGroupeId);
      eleves.set(move.eleveId, sources);
    }

    return {
      key: target.key,
      groupeId: target.groupeId ?? null,
      nom: (target.nom ?? "").trim(),
      profId: target.profId ?? null,
      matiereId: target.matiereId ?? null,
      prixParSeance: effectivePrice(target),
      forfaitMontant: target.forfaitMontant ?? null,
      forfaitSeances: target.forfaitSeances ?? null,
      capaciteMax: target.capaciteMax ?? null,
      planningFromGroupeId: target.planningFromGroupeId ?? null,
      isNew: !target.groupeId,
      eleves,
    };
  });

  for (const group of planned) {
    if (group.isNew) {
      if (group.nom.length < 2) {
        throw new RepartitionError("Chaque nouveau groupe doit avoir un nom (2 caractères minimum)");
      }
      if (!group.prixParSeance || group.prixParSeance <= 0) {
        throw new RepartitionError(`Le prix par séance du groupe « ${group.nom} » est invalide`);
      }
    }
    if (group.eleves.size === 0) {
      throw new RepartitionError(
        `Le groupe cible « ${group.nom || group.groupeId} » ne contient aucun élève`
      );
    }
  }

  const allSourceIds = new Set<string>();
  for (const target of planned) {
    for (const sources of target.eleves.values()) {
      for (const sourceId of sources) allSourceIds.add(sourceId);
    }
  }
  const allGroupeIds = new Set<string>([
    ...allSourceIds,
    ...planned.map((p) => p.groupeId).filter((id): id is string => !!id),
    ...planned.map((p) => p.planningFromGroupeId).filter((id): id is string => !!id),
  ]);

  const groupes = await tx.groupe.findMany({
    where: { id: { in: [...allGroupeIds] }, centerId },
    select: {
      id: true,
      nom: true,
      statut: true,
      profId: true,
      matiereId: true,
      prixParSeance: true,
      forfaitMontant: true,
      forfaitSeances: true,
      capaciteMax: true,
    },
  });
  const groupeById = new Map(groupes.map((g) => [g.id, g]));

  if (groupes.length !== allGroupeIds.size) {
    throw new RepartitionError("Un des groupes sélectionnés est introuvable", 404);
  }

  for (const sourceId of allSourceIds) {
    const groupe = groupeById.get(sourceId)!;
    if (groupe.statut === "archive") {
      throw new RepartitionError(
        `Le groupe « ${groupe.nom} » est archivé : il ne peut pas être réorganisé`
      );
    }
  }

  for (const group of planned) {
    if (group.groupeId) {
      const existing = groupeById.get(group.groupeId)!;
      if (existing.statut === "archive") {
        throw new RepartitionError(`Le groupe cible « ${existing.nom} » est archivé`);
      }
      group.nom = existing.nom;
      group.profId = existing.profId;
      group.matiereId = existing.matiereId;
      group.prixParSeance = Number(existing.prixParSeance);
      group.forfaitMontant = existing.forfaitMontant ? Number(existing.forfaitMontant) : null;
      group.forfaitSeances = existing.forfaitSeances ?? null;
      group.capaciteMax = existing.capaciteMax ?? null;
      for (const sources of group.eleves.values()) {
        if (sources.includes(group.groupeId)) {
          throw new RepartitionError(
            `Les élèves du groupe « ${existing.nom} » ne peuvent pas être déplacés vers ce même groupe`
          );
        }
      }
    } else {
      // Héritage des attributs du groupe d'origine quand ils ne sont pas fournis.
      const sources = new Set<string>();
      for (const list of group.eleves.values()) for (const id of list) sources.add(id);
      if (sources.size === 1) {
        const source = groupeById.get([...sources][0])!;
        if (!group.profId) group.profId = source.profId;
        if (!group.matiereId) group.matiereId = source.matiereId;
        if (!group.planningFromGroupeId) group.planningFromGroupeId = source.id;
      }
    }
    if (group.planningFromGroupeId === group.groupeId) {
      group.planningFromGroupeId = null;
    }
    if (group.planningFromGroupeId) {
      if (!groupeById.has(group.planningFromGroupeId)) {
        throw new RepartitionError("Le groupe source du planning est introuvable", 404);
      }
    }
  }

  const pairs: RepartitionMove[] = [];
  const seenPairs = new Set<string>();
  for (const target of planned) {
    for (const [eleveId, sources] of target.eleves) {
      for (const sourceGroupeId of sources) {
        const pairKey = `${eleveId}|${sourceGroupeId}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        pairs.push({ eleveId, sourceGroupeId });
      }
    }
  }

  const inscriptions = await tx.inscription.findMany({
    where: {
      statut: "actif",
      OR: pairs.map((p) => ({ eleveId: p.eleveId, groupeId: p.sourceGroupeId })),
    },
    select: {
      id: true,
      eleveId: true,
      groupeId: true,
      forfaitMontant: true,
      forfaitSeances: true,
      eleve: { select: { id: true, nom: true, prenom: true, deletedAt: true, ghost: true } },
    },
  });

  const inscriptionByPair = new Map(inscriptions.map((i) => [`${i.eleveId}|${i.groupeId}`, i]));

  for (const pair of pairs) {
    const inscription = inscriptionByPair.get(`${pair.eleveId}|${pair.sourceGroupeId}`);
    if (!inscription) {
      throw new RepartitionError(
        "Un élève sélectionné n'est plus inscrit dans le groupe d'origine. Rechargez la page et réessayez.",
        409
      );
    }
    if (inscription.eleve.deletedAt || inscription.eleve.ghost) {
      throw new RepartitionError(
        `L'élève ${inscription.eleve.prenom} ${inscription.eleve.nom} est archivé et ne peut pas être réorganisé`
      );
    }
  }

  const existingTargetPairs = planned
    .filter((p) => !!p.groupeId)
    .flatMap((p) => [...p.eleves.keys()].map((eleveId) => ({ eleveId, groupeId: p.groupeId! })));
  if (existingTargetPairs.length > 0) {
    const already = await tx.inscription.findMany({
      where: {
        statut: "actif",
        OR: existingTargetPairs.map((p) => ({ eleveId: p.eleveId, groupeId: p.groupeId })),
      },
      select: { eleveId: true, groupeId: true },
    });
    if (already.length > 0) {
      const cible = groupeById.get(already[0].groupeId);
      throw new RepartitionError(
        `Un élève est déjà inscrit dans le groupe cible « ${cible?.nom ?? ""} »`
      );
    }
  }

  const counts = await tx.inscription.groupBy({
    by: ["groupeId"],
    where: { groupeId: { in: [...allSourceIds] }, statut: "actif" },
    _count: { _all: true },
  });
  const activeCount = new Map(counts.map((c) => [c.groupeId, c._count._all]));
  const movedPerSource = new Map<string, number>();
  for (const pair of pairs) {
    movedPerSource.set(pair.sourceGroupeId, (movedPerSource.get(pair.sourceGroupeId) ?? 0) + 1);
  }
  const remaining = new Map<string, number>();
  for (const sourceId of allSourceIds) {
    remaining.set(
      sourceId,
      Math.max(0, (activeCount.get(sourceId) ?? 0) - (movedPerSource.get(sourceId) ?? 0))
    );
  }

  // Absorption de l'historique : groupe entièrement vidé, vers un seul groupe
  // cible, avec le même professeur.
  const absorb = new Map<string, string>();
  if (input.fusionnerHistorique !== false) {
    for (const sourceId of allSourceIds) {
      if ((remaining.get(sourceId) ?? 0) > 0) continue;
      const targetsOfSource = planned.filter((p) =>
        [...p.eleves.values()].some((sources) => sources.includes(sourceId))
      );
      if (targetsOfSource.length !== 1) continue;
      const target = targetsOfSource[0];
      const sourceGroupe = groupeById.get(sourceId)!;
      if ((sourceGroupe.profId ?? null) === (target.profId ?? null)) {
        absorb.set(sourceId, target.key);
      }
    }
  }

  return {
    planned,
    groupeById,
    inscriptionByPair,
    remaining,
    absorb,
    pairs,
    allSourceIds: [...allSourceIds],
    elevesDeplaces: eleveTarget.size,
  };
}

async function assertPassword(
  tx: Prisma.TransactionClient,
  actorId: string,
  motDePasse: string | null | undefined
) {
  if (!motDePasse) {
    throw new RepartitionError(
      "Le mot de passe est requis pour déplacer l'historique (séances et paiements)"
    );
  }
  const user = await tx.utilisateur.findUnique({
    where: { id: actorId },
    select: { motDePasse: true },
  });
  if (!user?.motDePasse) {
    throw new RepartitionError("Compte sans mot de passe");
  }
  const ok = await bcrypt.compare(motDePasse, user.motDePasse);
  if (!ok) {
    throw new RepartitionError("Mot de passe incorrect", 401);
  }
}

async function runTransaction(params: {
  centerId: string;
  actorId: string;
  input: RepartitionInput;
}): Promise<{ result: RepartitionResult; eleveIds: string[] }> {
  const { centerId, actorId, input } = params;
  const effectDate = todayDateInputValue();
  const effectDateValue = dateOnly(effectDate);

  return prisma.$transaction(
    async (tx) => {
      const plan = await buildPlan(tx, centerId, input);

      if (plan.absorb.size > 0) {
        await assertPassword(tx, actorId, input.motDePasse);
      }

      const archiveSources = input.archiverSourcesVides !== false;

      // 1) Création des groupes cibles manquants.
      const targetIdByKey = new Map<string, string>();
      for (const group of plan.planned) {
        if (group.groupeId) {
          targetIdByKey.set(group.key, group.groupeId);
          continue;
        }
        const created = await tx.groupe.create({
          data: {
            centerId,
            nom: group.nom,
            profId: group.profId,
            matiereId: group.matiereId,
            prixParSeance: group.prixParSeance,
            forfaitMontant: group.forfaitMontant,
            forfaitSeances: group.forfaitSeances,
            capaciteMax: group.capaciteMax,
          },
          select: { id: true },
        });
        targetIdByKey.set(group.key, created.id);
        group.groupeId = created.id;
      }

      // 2) Déplacement des périodes d'inscription.
      let elevesDeplaces = 0;
      const notifications: {
        centerId: string;
        destinataireId: string;
        titre: string;
        message: string;
        type: string;
        lien: string;
      }[] = [];

      for (const group of plan.planned) {
        const targetId = targetIdByKey.get(group.key)!;
        for (const [eleveId, sourceIds] of group.eleves) {
          const inscriptions = sourceIds
            .map((sourceId) => plan.inscriptionByPair.get(`${eleveId}|${sourceId}`))
            .filter((i): i is NonNullable<typeof i> => !!i);

          await tx.inscription.updateMany({
            where: { id: { in: inscriptions.map((i) => i.id) } },
            data: { statut: "inactif", dateFin: effectDateValue, dateFinSource: "deduit" },
          });

          const forfaitSource =
            inscriptions.find((i) => i.forfaitMontant != null && i.forfaitSeances != null) ?? null;

          await tx.inscription.create({
            data: {
              eleveId,
              groupeId: targetId,
              statut: "actif",
              dateDebut: effectDateValue,
              dateDebutSource: "saisie",
              forfaitMontant: forfaitSource?.forfaitMontant ?? null,
              forfaitSeances: forfaitSource?.forfaitSeances ?? null,
              forfaitSetAt: forfaitSource ? new Date() : null,
            },
          });
          elevesDeplaces += 1;

          const eleve = inscriptions[0]?.eleve;
          if (eleve) {
            const anciens = sourceIds
              .map((id) => plan.groupeById.get(id)?.nom)
              .filter((n): n is string => !!n);
            notifications.push({
              centerId,
              destinataireId: eleveId,
              titre: "Changement de groupe",
              message: `${eleve.prenom} ${eleve.nom}, vous êtes désormais dans le groupe « ${group.nom} »${
                anciens.length > 0 ? ` (auparavant « ${anciens.join(" », « ")} »)` : ""
              }. Vos paiements, votre solde et votre historique sont conservés.`,
              type: "changement_groupe",
              lien: "/eleve/groupes",
            });
          }
        }
      }

      // 3) Historique absorbé (fusion complète, même professeur).
      const absorbedSources = new Set(plan.absorb.keys());
      const sourcesSummary = new Map<string, RepartitionSourceSummary>();
      for (const sourceId of plan.allSourceIds) {
        const groupe = plan.groupeById.get(sourceId)!;
        sourcesSummary.set(sourceId, {
          groupeId: sourceId,
          nom: groupe.nom,
          deplaces: plan.pairs.filter((p) => p.sourceGroupeId === sourceId).length,
          restants: plan.remaining.get(sourceId) ?? 0,
          archive: false,
          historiqueAbsorbe: false,
          seancesDeplacees: 0,
          paiementsDeplaces: 0,
          seancesFuturesAnnulees: 0,
        });
      }

      for (const [sourceId, targetKey] of plan.absorb) {
        const targetId = targetIdByKey.get(targetKey)!;
        const summary = sourcesSummary.get(sourceId)!;
        const sourceGroupe = plan.groupeById.get(sourceId)!;

        // Le prix de chaque séance déplacée est figé sur sa valeur effective :
        // le montant dû reste identique même si la cible a un autre tarif.
        const movedSessions = await tx.$executeRaw`
          UPDATE seances
          SET groupe_id = ${targetId}::uuid,
              prix_par_seance = COALESCE(prix_par_seance, ${Number(sourceGroupe.prixParSeance)}::numeric)
          WHERE groupe_id = ${sourceId}::uuid`;

        const movedPayments = await tx.paiement.updateMany({
          where: { groupeId: sourceId },
          data: { groupeId: targetId },
        });

        await tx.teacherTransaction.updateMany({
          where: { groupeId: sourceId },
          data: { groupeId: targetId },
        });
        await tx.teacherCenterDebt.updateMany({
          where: { groupeId: sourceId },
          data: { groupeId: targetId },
        });

        summary.historiqueAbsorbe = true;
        summary.seancesDeplacees = Number(movedSessions);
        summary.paiementsDeplaces = movedPayments.count;
      }

      // 4) Copies du planning pour les groupes cibles.
      const today = effectDateValue;
      const copiedByTarget = new Map<string, number>();

      for (const group of plan.planned) {
        if (!group.planningFromGroupeId) continue;
        if (absorbedSources.has(group.planningFromGroupeId)) continue;
        const targetId = targetIdByKey.get(group.key)!;

        const future = await tx.seance.findMany({
          where: {
            groupeId: group.planningFromGroupeId,
            date: { gt: today },
            statut: "planifiee",
            presences: { none: {} },
          },
          select: {
            date: true,
            heureDebut: true,
            heureFin: true,
            notes: true,
            prixParSeance: true,
          },
          orderBy: { date: "asc" },
        });
        if (future.length === 0) continue;

        const existing = await tx.seance.findMany({
          where: { groupeId: targetId, date: { gt: today } },
          select: { date: true, heureDebut: true },
        });
        const signature = (d: Date, h: Date | null) =>
          `${d.toISOString().slice(0, 10)}|${h ? h.toISOString().slice(11, 16) : ""}`;
        const taken = new Set(existing.map((s) => signature(s.date, s.heureDebut)));

        const toCreate = future
          .filter((s) => !taken.has(signature(s.date, s.heureDebut)))
          .map((s) => ({
            groupeId: targetId,
            date: s.date,
            heureDebut: s.heureDebut,
            heureFin: s.heureFin,
            notes: s.notes,
            statut: "planifiee" as const,
            prixParSeance: s.prixParSeance ?? new Prisma.Decimal(group.prixParSeance),
          }));

        if (toCreate.length > 0) {
          await tx.seance.createMany({ data: toCreate });
          copiedByTarget.set(group.key, (copiedByTarget.get(group.key) ?? 0) + toCreate.length);
        }
      }

      // 5) Archivage des groupes vidés + annulation de leurs séances futures.
      for (const sourceId of plan.allSourceIds) {
        const summary = sourcesSummary.get(sourceId)!;
        if ((plan.remaining.get(sourceId) ?? 0) > 0) continue;

        if (!absorbedSources.has(sourceId)) {
          const cancelled = await tx.seance.updateMany({
            where: {
              groupeId: sourceId,
              date: { gt: today },
              statut: "planifiee",
              presences: { none: {} },
            },
            data: { statut: "annulee" },
          });
          summary.seancesFuturesAnnulees = cancelled.count;
        }

        if (archiveSources) {
          await tx.groupe.update({
            where: { id: sourceId },
            data: {
              statut: "archive",
              archivedAt: new Date(),
              archivedById: actorId,
              archiveMotif: `${ARCHIVE_MOTIF_PREFIX} du ${effectDate}${
                summary.historiqueAbsorbe ? " (historique transféré)" : ""
              }`,
            },
          });
          summary.archive = true;
        }
      }

      const targets: RepartitionTargetSummary[] = plan.planned.map((group) => ({
        key: group.key,
        groupeId: targetIdByKey.get(group.key)!,
        nom: group.nom,
        nouveau: group.isNew,
        eleves: group.eleves.size,
        seancesCopiees: copiedByTarget.get(group.key) ?? 0,
      }));

      if (notifications.length > 0) {
        await tx.notification.createMany({ data: notifications });
      }

      await tx.systemLog.create({
        data: {
          action: "groupe.repartition",
          entity: "groupe",
          entityId: targets[0]?.groupeId ?? null,
          userId: actorId,
          details: {
            effectDate,
            fusionnerHistorique: input.fusionnerHistorique !== false,
            archiveSources,
            sources: [...sourcesSummary.values()],
            targets,
            eleves: plan.planned.map((g) => ({
              target: g.key,
              eleves: [...g.eleves.entries()].map(([eleveId, from]) => ({ eleveId, from })),
            })),
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        result: {
          effectDate,
          elevesDeplaces,
          sources: [...sourcesSummary.values()],
          targets,
        } as RepartitionResult,
        eleveIds: notifications.map((n) => n.destinataireId),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }
  );
}

export async function executeRepartition(params: {
  centerId: string;
  actorId: string;
  input: RepartitionInput;
}): Promise<RepartitionResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { result, eleveIds } = await runTransaction(params);

      logger.info("Réorganisation des groupes effectuée", {
        centerId: params.centerId,
        actorId: params.actorId,
        elevesDeplaces: result.elevesDeplaces,
        targets: result.targets.length,
        sourcesArchivees: result.sources.filter((s) => s.archive).length,
        historiquesTransferes: result.sources.filter((s) => s.historiqueAbsorbe).length,
      });

      if (eleveIds.length > 0) {
        void sendPushToUsers(eleveIds, {
          title: "Changement de groupe",
          body: "Votre groupe a été réorganisé. Consultez vos groupes pour voir le détail.",
          url: "/eleve/groupes",
        }).catch(() => {});
      }

      return result;
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string })?.code;
      if (code === "P2034" && attempt < 2) {
        // Conflit d'écriture en isolation Serializable : on rejoue la transaction.
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
