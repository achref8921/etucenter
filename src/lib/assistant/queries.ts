import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PeriodKey } from "./engine";

export const RATTRAPAGE_MARKER = "rattrapage";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function money(n: number): string {
  return formatCurrency(round2(n));
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function periodRange(period: PeriodKey, now = new Date()): { from: Date | null; to: Date | null } {
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week": {
      const day = now.getDay(); // 0=dimanche
      const diff = day === 0 ? 6 : day - 1;
      const monday = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff));
      return { from: monday, to: endOfDay(now) };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from, to };
    }
    case "prev_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from, to };
    }
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "last30":
      return { from: endOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), to: endOfDay(now) };
    case "all":
    default:
      return { from: null, to: endOfDay(now) };
  }
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Unpaid (même formule que le dashboard /admin) ─────────────────────────

interface UnpaidRow {
  eleve_id: string;
  prenom: string;
  nom: string;
  groupe_id: string;
  groupeNom: string;
  due: number;
  paid: number;
  remaining: number;
  lastPaid: Date | null;
}

export interface UnpaidResult {
  rows: UnpaidRow[];
  total: number;
  count: number;
}

export async function unpaidRows(
  centerId: string,
  period: PeriodKey,
  now = new Date(),
  profId?: string
): Promise<UnpaidResult> {
  const { from, to } = periodRange(period === "all" ? "all" : "month", now);
  const monthOnly = period !== "all";

  const dueFilter = monthOnly ? Prisma.sql`AND s.date >= ${from}::timestamptz` : Prisma.empty;
  const profFilter = profId ? Prisma.sql`AND g.prof_id = ${profId}::uuid` : Prisma.empty;
  const profFilter2 = profId ? Prisma.sql`AND g2.prof_id = ${profId}::uuid` : Prisma.empty;

  const raw = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`SELECT
        d.eleve_id, u.prenom, u.nom,
        d.groupe_id, g.nom AS groupe_nom,
        d.due_total::numeric AS due, COALESCE(p.paid_total,0)::numeric AS paid,
        (d.due_total - COALESCE(p.paid_total, 0))::numeric AS remaining,
        p.last_paid
      FROM (
        SELECT pr.eleve_id, s.groupe_id,
          SUM(
            CASE
              WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
              THEN (i.forfait_montant / i.forfait_seances)
              ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
            END
          ) as due_total
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
        WHERE pr.statut = 'present' AND s.statut <> 'annulee' AND g.center_id = ${centerId}::uuid ${dueFilter} ${profFilter}
        GROUP BY pr.eleve_id, s.groupe_id
      ) d
      LEFT JOIN (
        SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) as paid_total, MAX(pai.date_paiement) as last_paid
        FROM paiements pai
        JOIN groupes g2 ON pai.groupe_id = g2.id
        WHERE g2.center_id = ${centerId}::uuid ${profFilter2}
        GROUP BY pai.eleve_id, pai.groupe_id
      ) p ON d.eleve_id = p.eleve_id AND d.groupe_id = p.groupe_id
      JOIN utilisateurs u ON u.id = d.eleve_id
      JOIN groupes g ON g.id = d.groupe_id
      WHERE (d.due_total - COALESCE(p.paid_total, 0)) > 0
      ORDER BY remaining DESC`
  );

  const rows: UnpaidRow[] = raw.map((r) => ({
    eleve_id: String(r.eleve_id),
    prenom: String(r.prenom ?? ""),
    nom: String(r.nom ?? ""),
    groupe_id: String(r.groupe_id),
    groupeNom: String(r.groupe_nom ?? ""),
    due: Number(r.due ?? 0),
    paid: Number(r.paid ?? 0),
    remaining: Number(r.remaining ?? 0),
    lastPaid: r.last_paid ? new Date(String(r.last_paid)) : null,
  }));

  return {
    rows,
    total: round2(rows.reduce((s, r) => s + r.remaining, 0)),
    count: rows.length,
  };
}

// ─── Revenu par matière (même logique paid_this_month du dashboard) ────────

export async function revenueByMatiere(centerId: string, period: PeriodKey, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const raw = await prisma.$queryRawUnsafe<{ matiere_nom: string | null; revenue: number }[]>(
    `WITH all_sessions AS (
        SELECT pr.eleve_id, s.groupe_id, g.matiere_id,
          CASE
            WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
            THEN (i.forfait_montant / i.forfait_seances)
            ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
          END as price,
          s.date as seance_date
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
        WHERE pr.statut = 'present' AND s.statut = 'terminee' AND g.center_id = $1::uuid
          AND s.date <= $2::timestamptz
      ),
      student_dues AS (
        SELECT eleve_id, groupe_id, matiere_id,
          SUM(price) as total_due,
          SUM(CASE WHEN seance_date >= $3::timestamptz THEN price ELSE 0 END) as due_this_month
        FROM all_sessions GROUP BY eleve_id, groupe_id, matiere_id
      ),
      student_payments AS (
        SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) as total_paid
        FROM paiements pai JOIN groupes g ON pai.groupe_id = g.id
        WHERE g.center_id = $1::uuid AND pai.date_paiement <= $2::timestamptz
        GROUP BY pai.eleve_id, pai.groupe_id
      ),
      paid_this_month AS (
        SELECT sd.eleve_id, sd.groupe_id, sd.matiere_id,
          GREATEST(0, LEAST(sd.due_this_month, GREATEST(0, COALESCE(sp.total_paid, 0) - (sd.total_due - sd.due_this_month)))) as paid_amount
        FROM student_dues sd
        LEFT JOIN student_payments sp ON sd.eleve_id = sp.eleve_id AND sd.groupe_id = sp.groupe_id
        WHERE sd.due_this_month > 0
      )
      SELECT COALESCE(m.nom, 'Sans matière') as matiere_nom,
             COALESCE(SUM(pm.paid_amount), 0)::float as revenue
      FROM paid_this_month pm
      JOIN groupes g ON pm.groupe_id = g.id
      LEFT JOIN matieres m ON g.matiere_id = m.id
      GROUP BY m.nom
      ORDER BY revenue DESC`,
    centerId,
    to,
    from
  );
  return raw.map((r) => ({ nom: r.matiere_nom ?? "Sans matière", revenue: round2(r.revenue || 0) }));
}

// ─── Attentes / présences ──────────────────────────────────────────────────

type PresenceCountRow = { statut: string; _count: number };

export interface SeanceScope {
  centerId: string;
  profId?: string;
}

function presenceWhere(scope: SeanceScope, period: PeriodKey, now = new Date()) {
  const { from, to } = periodRange(period, now);
  return {
    statut: { in: ["present", "absent"] as any },
    seance: {
      date: { gte: from ?? undefined, lte: to },
      statut: { not: "annulee" as any },
      groupe: { centerId: scope.centerId, ...(scope.profId ? { profId: scope.profId } : {}) },
    },
  } as any;
}

export async function attendanceCounts(scope: SeanceScope, period: PeriodKey, now = new Date()) {
  const rows = (await prisma.presence.groupBy({
    by: ["statut"],
    where: presenceWhere(scope, period, now),
    _count: true,
  })) as unknown as PresenceCountRow[];
  let present = 0;
  let absent = 0;
  for (const r of rows) {
    if (r.statut === "present") present = r._count;
    else if (r.statut === "absent") absent = r._count;
  }
  return { present, absent, total: present + absent };
}

export interface AbsentEntry {
  nom: string;
  prenom: string;
  groupeNom: string;
  date: string;
  heure: string;
}

export async function absentList(scope: SeanceScope, period: PeriodKey, now = new Date()): Promise<AbsentEntry[]> {
  const p = presenceWhere(scope, period, now);
  p.statut = "absent";
  const rows = await prisma.presence.findMany({
    where: p,
    take: 30,
    orderBy: [{ seance: { date: "desc" } }],
    select: {
      eleve: { select: { prenom: true, nom: true } },
      seance: { select: { date: true, heureDebut: true, groupe: { select: { nom: true } } } },
    },
  });
  return rows.map((r) => ({
    nom: r.eleve.nom,
    prenom: r.eleve.prenom,
    groupeNom: r.seance.groupe.nom,
    date: formatDate(r.seance.date),
    heure:
      r.seance.heureDebut != null
        ? r.seance.heureDebut.toISOString().slice(11, 16)
        : "",
  }));
}

export async function mostAbsentStudents(
  scope: SeanceScope,
  period: PeriodKey,
  n = 5,
  now = new Date()
) {
  const { from, to } = periodRange(period, now);
  const raw = await prisma.$queryRaw`
    SELECT u.id, u.prenom, u.nom, COUNT(*)::int AS nb
    FROM presences pr
    JOIN seances s ON pr.seance_id = s.id
    JOIN groupes g ON s.groupe_id = g.id
    JOIN utilisateurs u ON u.id = pr.eleve_id
    WHERE pr.statut = 'absent'
      AND g.center_id = ${scope.centerId}::uuid
      ${scope.profId ? Prisma.sql`AND g.prof_id = ${scope.profId}::uuid` : Prisma.empty}
      AND s.date >= ${from ?? new Date(0)}::timestamptz
      AND s.date <= ${to}::timestamptz
      AND s.statut <> 'annulee'
    GROUP BY u.id
    ORDER BY nb DESC
    LIMIT ${n}`;
  return (raw as any[]).map((r) => ({
    prenom: String(r.prenom ?? ""),
    nom: String(r.nom ?? ""),
    count: Number(r.nb ?? 0),
  }));
}

export async function mostAbsentGroups(centerId: string, period: PeriodKey, n = 5, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const raw = await prisma.$queryRaw`
    SELECT g.id, g.nom AS nom, COUNT(*)::int AS nb
    FROM presences pr
    JOIN seances s ON pr.seance_id = s.id
    JOIN groupes g ON s.groupe_id = g.id
    WHERE pr.statut = 'absent'
      AND g.center_id = ${centerId}::uuid
      AND s.date >= ${from ?? new Date(0)}::timestamptz
      AND s.date <= ${to}::timestamptz
      AND s.statut <> 'annulee'
    GROUP BY g.id
    ORDER BY nb DESC
    LIMIT ${n}`;
  return (raw as any[]).map((r) => ({
    id: String(r.id),
    nom: String(r.nom ?? ""),
    count: Number(r.nb ?? 0),
  }));
}

export async function mostAbsentProfs(centerId: string, period: PeriodKey, n = 5, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const raw = await prisma.$queryRaw`
    SELECT u.id, u.prenom, u.nom, COUNT(*)::int AS nb
    FROM presences pr
    JOIN seances s ON pr.seance_id = s.id
    JOIN groupes g ON s.groupe_id = g.id
    JOIN utilisateurs u ON u.id = g.prof_id
    WHERE pr.statut = 'absent'
      AND g.center_id = ${centerId}::uuid
      AND s.date >= ${from ?? new Date(0)}::timestamptz
      AND s.date <= ${to}::timestamptz
      AND s.statut <> 'annulee'
    GROUP BY u.id
    ORDER BY nb DESC
    LIMIT ${n}`;
  return (raw as any[]).map((r) => ({
    prenom: String(r.prenom ?? ""),
    nom: String(r.nom ?? ""),
    count: Number(r.nb ?? 0),
  }));
}

// ─── Séances ───────────────────────────────────────────────────────────────

export interface SeanceInfo {
  date: string;
  heure: string;
  groupeNom: string;
  matiere: string | null;
  prof: { prenom: string; nom: string } | null;
  statut: string;
  n: number;
}

export async function seancesInRange(
  scope: SeanceScope,
  period: PeriodKey,
  now = new Date()
): Promise<SeanceInfo[]> {
  const { from, to } = periodRange(period, now);
  const rows = await prisma.seance.findMany({
    where: {
      date: { gte: from ?? undefined, lte: to ?? undefined },
      statut: { not: "annulee" },
      groupe: { centerId: scope.centerId, ...(scope.profId ? { profId: scope.profId } : {}) },
    },
    orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
    select: {
      date: true,
      heureDebut: true,
      statut: true,
      groupe: {
        select: {
          nom: true,
          matiere: { select: { nom: true } },
          prof: { select: { prenom: true, nom: true } },
        },
      },
      _count: { select: { presences: true } },
    },
  });
  return rows.map((r) => ({
    date: formatDate(r.date),
    heure: r.heureDebut != null ? r.heureDebut.toISOString().slice(11, 16) : "",
    groupeNom: r.groupe.nom,
    matiere: r.groupe.matiere?.nom ?? null,
    prof: r.groupe.prof
      ? { prenom: r.groupe.prof.prenom, nom: r.groupe.prof.nom }
      : null,
    statut: r.statut,
    n: r._count.presences,
  }));
}

export async function unverifiedSeances(scope: SeanceScope, n = 10) {
  const rows = await prisma.seance.findMany({
    where: {
      statut: "terminee",
      groupe: { centerId: scope.centerId, ...(scope.profId ? { profId: scope.profId } : {}) },
      presences: { none: {} },
    },
    orderBy: { date: "desc" },
    take: n,
    select: {
      date: true,
      heureDebut: true,
      groupe: {
        select: {
          nom: true,
          matiere: { select: { nom: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    date: formatDate(r.date),
    heure: r.heureDebut != null ? r.heureDebut.toISOString().slice(11, 16) : "",
    groupeNom: r.groupe.nom,
    matiere: r.groupe.matiere?.nom ?? null,
  }));
}

export async function rattrapageSeances(scope: SeanceScope, period: PeriodKey, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const rows = await prisma.seance.findMany({
    where: {
      notes: { contains: RATTRAPAGE_MARKER, mode: "insensitive" },
      statut: { not: "annulee" },
      date: { gte: from ?? undefined, lte: to ?? undefined },
      groupe: { centerId: scope.centerId, ...(scope.profId ? { profId: scope.profId } : {}) },
    },
    orderBy: { date: "desc" },
    select: {
      date: true,
      heureDebut: true,
      groupe: {
        select: {
          nom: true,
          prof: { select: { prenom: true, nom: true } },
        },
      },
      _count: { select: { presences: true } },
    },
  });
  return rows.map((r) => ({
    date: formatDate(r.date),
    heure: r.heureDebut != null ? r.heureDebut.toISOString().slice(11, 16) : "",
    groupeNom: r.groupe.nom,
    prof: r.groupe.prof ? `${r.groupe.prof.prenom} ${r.groupe.prof.nom}` : null,
    n: r._count.presences,
  }));
}

// ─── Recherche par nom (best match) ───────────────────────────────────────

interface NamedEntity {
  id: string;
  search: string; // "prenom nom" majeurs
  [k: string]: unknown;
}

const AR_TO_LATIN: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "a", "آ": "a", "ب": "b", "ت": "t", "ث": "th",
  "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z",
  "س": "s", "ش": "ch", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a",
  "غ": "gh", "ف": "f", "ق": "g", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "و": "o", "ي": "i", "ة": "a",
};

function romanize(s: string): string {
  let out = "";
  const low = s.toLowerCase();
  for (let i = 0; i < low.length; i++) {
    const c = low[i];
    if (c === "ي" && i + 1 < low.length && low[i + 1] === "ا") {
      out += "ya";
      i++;
      continue;
    }
    if (c === "ي" && i + 1 < low.length && low[i + 1] === "و") {
      out += "yo";
      i++;
      continue;
    }
    const m = AR_TO_LATIN[c] ?? c;
    out += m;
  }
  return out.replace(/[^a-z0-9 ]/g, "").replace(/\s{2,}/g, " ").trim();
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function levMatch(a: string, b: string): boolean {
  const d = lev(a, b);
  if (d === 0) return true;
  if (a.length >= 4 && b.length >= 4) return d <= 2;
  if (a.length >= 3 && b.length >= 3) return d <= 1;
  return false;
}

export async function findBestMatch<T extends NamedEntity>(msg: string, items: T[]): Promise<T | null> {
  const hay = msg.toLowerCase().replace(/[أإآ]/g, "ا");
  const msgTokens = hay
    .split(/[\s,،.]+/)
    .filter((w) => w.length >= 2);
  const msgRomanized = romanize(hay)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);

  let best: T | null = null;
  let bestScore = 0;

  for (const it of items) {
    let score = 0;
    const name = it.search.toLowerCase().replace(/[أإآ]/g, "ا");
    const words = name.split(/\s+/).filter(Boolean);
    const romanWords = romanize(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);

    for (const mt of msgTokens) {
      for (const w of words) {
        if (mt.length >= 3 && w.length >= 3 && (mt.includes(w) || w.includes(mt))) {
          score++;
        }
      }
      for (const rw of romanWords) {
        if (levMatch(mt, rw) || (mt.length >= 3 && rw.includes(mt))) {
          score++;
        }
      }
    }
    for (const mr of msgRomanized) {
      for (const rw of romanWords) {
        if (levMatch(mr, rw)) {
          score++;
        }
      }
    }

    // bonus si le token entier du message = nom complet
    const fullRoman = romanWords.join(" ");
    const fullMsgRoman = msgRomanized.join(" ");
    if ((fullRoman === fullMsgRoman) || msgTokens.join(" ") === words.join(" ")) {
      score += 3;
    }

    if (score > bestScore) {
      best = it;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function candidateStudents(centerId: string, profId?: string) {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: {
      centerId,
      role: "eleve",
      deletedAt: null,
      ghost: false,
      ...(profId
        ? { inscriptions: { some: { statut: "actif", groupe: { profId } } } }
        : {}),
    },
    select: {
      id: true,
      prenom: true,
      nom: true,
      telephone: true,
      niveau: true,
      classe: true,
    },
  });
  return utilisateurs.map((u) => ({
    ...u,
    search: `${u.prenom} ${u.nom}`.toLowerCase(),
  }));
}

// ─── Vague 2 : décision-support (briefs, santé, recouvrement, risque) ──────

export async function revenueToday(centerId: string, now = new Date()) {
  const from = startOfDay(now);
  const to = endOfDay(now);
  const agg = await prisma.paiement.aggregate({
    _sum: { montant: true },
    _count: { _all: true },
    where: { datePaiement: { gte: from, lte: to }, groupe: { centerId } },
  });
  return {
    total: round2(Number(agg._sum.montant ?? 0)),
    count: Number(agg._count._all ?? 0),
  };
}

export interface CollectionStats {
  paid: number;
  due: number;
  rate: number; // 0..1
}

export async function collectionStats(centerId: string, now = new Date()): Promise<CollectionStats> {
  const { from, to } = periodRange("month", now);
  const raw = await prisma.$queryRawUnsafe<{ paid: number; due: number }[]>(
    `WITH all_sessions AS (
        SELECT pr.eleve_id, s.groupe_id,
          CASE
            WHEN i.forfait_montant IS NOT NULL AND i.forfait_seances IS NOT NULL AND i.forfait_seances > 0
            THEN (i.forfait_montant / i.forfait_seances)
            ELSE COALESCE(s.prix_par_seance, g.prix_par_seance)
          END as price,
          s.date as seance_date
        FROM presences pr
        JOIN seances s ON pr.seance_id = s.id
        JOIN groupes g ON s.groupe_id = g.id
        LEFT JOIN inscriptions i ON i.eleve_id = pr.eleve_id AND i.groupe_id = g.id AND i.statut = 'actif'
        WHERE pr.statut = 'present' AND s.statut = 'terminee' AND g.center_id = $1::uuid
          AND s.date <= $2::timestamptz
      ),
      student_dues AS (
        SELECT eleve_id, groupe_id,
          SUM(price) as total_due,
          SUM(CASE WHEN seance_date >= $3::timestamptz THEN price ELSE 0 END) as due_this_month
        FROM all_sessions GROUP BY eleve_id, groupe_id
      ),
      student_payments AS (
        SELECT pai.eleve_id, pai.groupe_id, SUM(pai.montant) as total_paid
        FROM paiements pai JOIN groupes g ON pai.groupe_id = g.id
        WHERE g.center_id = $1::uuid AND pai.date_paiement <= $2::timestamptz
        GROUP BY pai.eleve_id, pai.groupe_id
      ),
      paid_this_month AS (
        SELECT sd.eleve_id, sd.groupe_id,
          GREATEST(0, LEAST(sd.due_this_month, GREATEST(0, COALESCE(sp.total_paid, 0) - (sd.total_due - sd.due_this_month)))) as paid_amount
        FROM student_dues sd
        LEFT JOIN student_payments sp ON sd.eleve_id = sp.eleve_id AND sd.groupe_id = sp.groupe_id
        WHERE sd.due_this_month > 0
      )
      SELECT
        (SELECT COALESCE(SUM(sd.due_this_month),0)::float FROM student_dues sd) AS due,
        (SELECT COALESCE(SUM(pm.paid_amount),0)::float FROM paid_this_month pm) AS paid`,
    centerId,
    to,
    from
  );
  const paid = round2(Number(raw[0]?.paid ?? 0));
  const due = round2(Number(raw[0]?.due ?? 0));
  return { paid, due, rate: due > 0 ? paid / due : 1 };
}

export interface PaymentMethodRow {
  methode: string;
  nb: number;
  total: number;
}

export async function paymentMethods(centerId: string, now = new Date()) {
  const { from, to } = periodRange("month", now);
  const methods = await prisma.$queryRaw<{ methode: string; nb: number; total: number }[]>(
    Prisma.sql`SELECT pai.methode_paiement AS methode, COUNT(*)::int AS nb, SUM(pai.montant)::float AS total
      FROM paiements pai
      JOIN groupes g ON pai.groupe_id = g.id
      WHERE g.center_id = ${centerId}::uuid
        AND pai.date_paiement >= ${from}::timestamptz AND pai.date_paiement <= ${to}::timestamptz
      GROUP BY pai.methode_paiement
      ORDER BY total DESC`
  );
  const bestMonth = await prisma.$queryRaw<{ ym: string; total: number }[]>(
    Prisma.sql`SELECT to_char(pai.date_paiement, 'YYYY-MM') AS ym, SUM(pai.montant)::float AS total
      FROM paiements pai
      JOIN groupes g ON pai.groupe_id = g.id
      WHERE g.center_id = ${centerId}::uuid
        AND pai.date_paiement >= ${new Date(now.getFullYear(), now.getMonth() - 5, 1)}::timestamptz
      GROUP BY ym
      ORDER BY total DESC
      LIMIT 1`
  );
  return {
    methods: methods.map((m) => ({ methode: m.methode, nb: Number(m.nb), total: round2(m.total) })),
    bestMonth: bestMonth[0] ? { ym: bestMonth[0].ym, total: round2(bestMonth[0].total) } : null,
  };
}

export interface ChurnRow {
  prenom: string;
  nom: string;
  groupeNom: string;
  lastDate: Date | null;
}

export async function churnRisk(centerId: string, days = 14, now = new Date()): Promise<ChurnRow[]> {
  const raw = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`SELECT u.prenom, u.nom, g.nom AS groupe_nom, MAX(s.date) AS last_date
      FROM presences pr
      JOIN seances s ON pr.seance_id = s.id
      JOIN groupes g ON s.groupe_id = g.id
      JOIN utilisateurs u ON u.id = pr.eleve_id
      WHERE pr.statut = 'present' AND s.statut <> 'annulee' AND g.center_id = ${centerId}::uuid
      GROUP BY u.id, g.id
      HAVING MAX(s.date) < (${endOfDay(new Date(now.getTime() - days * 86400000) as any as Date)}::timestamptz)::date
      ORDER BY MAX(s.date) DESC
      LIMIT 20`
  );
  return raw.map((r) => ({
    prenom: String(r.prenom ?? ""),
    nom: String(r.nom ?? ""),
    groupeNom: String(r.groupe_nom ?? ""),
    lastDate: r.last_date ? new Date(String(r.last_date)) : null,
  }));
}

export async function newStudentsMonth(centerId: string, now = new Date()) {
  const { from } = periodRange("month", now);
  const rows = await prisma.utilisateur.findMany({
    where: {
      centerId,
      role: "eleve",
      deletedAt: null,
      ghost: false,
      createdAt: { gte: from ?? undefined },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { prenom: true, nom: true, createdAt: true, classe: true },
  });
  return { count: rows.length, rows };
}

export interface ProfNoPointRow {
  prenom: string;
  nom: string;
  nb: number;
  groupes: string[];
}

export async function profVerificationToday(centerId: string, now = new Date()) {
  const from = startOfDay(now);
  const to = endOfDay(now);
  const raw = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`WITH unpointed AS (
        SELECT s.id AS seance_id, s.groupe_id
        FROM seances s
        WHERE s.statut = 'terminee' AND s.date >= ${from}::timestamptz AND s.date <= ${to}::timestamptz
          AND NOT EXISTS (SELECT 1 FROM presences pr WHERE pr.seance_id = s.id)
      )
      SELECT u.prenom, u.nom, COUNT(*)::int AS nb, array_agg(DISTINCT g.nom) AS groupes
      FROM unpointed up
      JOIN groupes g ON up.groupe_id = g.id
      JOIN utilisateurs u ON g.prof_id = u.id
      WHERE g.center_id = ${centerId}::uuid
      GROUP BY u.id
      ORDER BY nb DESC`
  );
  return raw.map((r) => ({
    prenom: String(r.prenom ?? ""),
    nom: String(r.nom ?? ""),
    nb: Number(r.nb ?? 0),
    groupes: Array.isArray(r.groupes) ? (r.groupes as string[]) : String(r.groupes ?? "").split(",").filter(Boolean),
  }));
}

export async function presenceCountsBySeance(seanceIds: string[]) {
  const map = new Map<string, { present: number; absent: number }>();
  if (seanceIds.length === 0) return map;
  const rows = await prisma.presence.groupBy({
    by: ["seanceId", "statut"],
    where: { seanceId: { in: seanceIds } },
    _count: true,
  });
  for (const r of rows) {
    const cur = map.get(r.seanceId) ?? { present: 0, absent: 0 };
    if (r.statut === "present") cur.present = r._count;
    else cur.absent = r._count;
    map.set(r.seanceId, cur);
  }
  return map;
}

export interface StudentProfileData {
  netBalance: number;
  present: number;
  absent: number;
  total: number;
  pct: number;
  lastDate: Date | null;
  groupes: string[];
  nextSeance: { date: Date; heure: string | null; groupeNom: string } | null;
}

export async function studentProfileData(
  centerId: string,
  studentId: string,
  profId?: string,
  now = new Date()
): Promise<StudentProfileData> {
  const scope = { centerId, ...(profId ? { profId } : {}) };
  const [txn, att, lastP, insc, next] = await Promise.all([
    prisma.studentTransaction.aggregate({
      _sum: { signedAmount: true },
      where: { eleveId: studentId, status: "active", reversedAt: null },
    }),
    prisma.presence.groupBy({
      by: ["statut"],
      where: {
        eleveId: studentId,
        seance: { statut: { not: "annulee" }, groupe: scope },
      },
      _count: true,
    }) as unknown as Promise<{ statut: string; _count: number }[]>,
    prisma.presence.findFirst({
      where: { eleveId: studentId, seance: { statut: { not: "annulee" }, groupe: scope } },
      orderBy: { seance: { date: "desc" } },
      select: { seance: { select: { date: true } } },
    }),
    prisma.inscription.findMany({
      where: { eleveId: studentId, statut: "actif", groupe: scope },
      select: { groupe: { select: { nom: true, matiere: { select: { nom: true } } } } },
    }),
    prisma.seance.findFirst({
      where: {
        date: { gte: startOfDay(now) },
        statut: { in: ["planifiee", "en_cours"] },
        groupe: {
          ...scope,
          inscriptions: { some: { eleveId: studentId, statut: "actif" } },
        },
      },
      orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
      select: { date: true, heureDebut: true, groupe: { select: { nom: true } } },
    }),
  ]);

  let present = 0;
  let absent = 0;
  for (const r of att) {
    if (r.statut === "present") present = r._count;
    else absent = r._count;
  }
  const total = present + absent;

  return {
    netBalance: round2(Number(txn._sum.signedAmount ?? 0)),
    present,
    absent,
    total,
    pct: total > 0 ? Math.round((present / total) * 100) : 0,
    lastDate: lastP?.seance.date ?? null,
    groupes: insc.map((i) => `${i.groupe.nom}${i.groupe.matiere ? ` (${i.groupe.matiere.nom})` : ""}`),
    nextSeance: next
      ? {
          date: next.date,
          heure: next.heureDebut ? next.heureDebut.toISOString().slice(0, 5) : null,
          groupeNom: next.groupe.nom,
        }
      : null,
  };
}