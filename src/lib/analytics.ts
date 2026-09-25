import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type { AnalyticsEventName } from "@prisma/client";

export const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;

const INACTIVITY_MS = SESSION_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const MAX_METADATA_KEYS = 12;
const MAX_METADATA_VALUE_LENGTH = 200;
const MAX_PATH_LENGTH = 255;
const MAX_FEATURE_LENGTH = 80;

const SENSITIVE_KEY_PATTERN =
  /(pass|pwd|secret|token|jwt|auth|cookie|session_id|apikey|api_key|credential|hash|otp|pin)/i;

export type AnalyticsEventInput = {
  userId: string;
  centerId: string;
  sessionId?: string | null;
  event: AnalyticsEventName;
  path?: string | null;
  feature?: string | null;
  metadata?: Record<string, unknown> | null;
  userAgent?: string | null;
};

function sanitizePath(path?: string | null): string | null {
  if (!path) return null;
  const cleaned = path.split("?")[0].slice(0, MAX_PATH_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeMetadata(
  metadata?: Record<string, unknown> | null
): Prisma.JsonObject | undefined {
  if (!metadata) return undefined;

  const out: Record<string, string | number | boolean> = {};
  let count = 0;

  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (SENSITIVE_KEY_PATTERN.test(rawKey)) continue;
    if (rawValue === null || rawValue === undefined) continue;

    const value =
      typeof rawValue === "number" || typeof rawValue === "boolean"
        ? rawValue
        : String(rawValue).slice(0, MAX_METADATA_VALUE_LENGTH);

    if (SENSITIVE_KEY_PATTERN.test(String(value))) continue;

    out[rawKey] = value;
    count++;
  }

  return Object.keys(out).length > 0 ? (out as Prisma.JsonObject) : undefined;
}

function sanitizeFeature(feature?: string | null): string | null {
  if (!feature) return null;
  return feature.slice(0, MAX_FEATURE_LENGTH);
}

export async function trackEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: input.userId,
        centerId: input.centerId,
        sessionId: input.sessionId ?? null,
        event: input.event,
        path: sanitizePath(input.path),
        feature: sanitizeFeature(input.feature),
        metadata: sanitizeMetadata(input.metadata),
        userAgent: input.userAgent ? input.userAgent.slice(0, 255) : null,
      },
    });
  } catch {}
}

export async function trackEventSafe(input: AnalyticsEventInput): Promise<void> {
  try {
    await trackEvent(input);
  } catch (error) {
    logger.warn("Échec silencieux du tracking analytics", {
      event: input.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type SessionEndReason =
  | "logout"
  | "unload"
  | "manual"
  | "inactivity"
  | "stale_sweep"
  | "closed";

async function closeSession(sessionId: string, endReason: SessionEndReason): Promise<void> {
  try {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { startedAt: true, lastActivityAt: true, endedAt: true },
    });

    if (!session || session.endedAt) return;

    const last = session.lastActivityAt.getTime();
    const durationSeconds = Math.max(
      0,
      Math.round((last - session.startedAt.getTime()) / 1000)
    );

    await prisma.userSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), durationSeconds, endReason },
    });
  } catch {}
}

export async function sweepStaleSessions(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - INACTIVITY_MS);
    const stale = await prisma.userSession.findMany({
      where: { endedAt: null, lastActivityAt: { lt: cutoff } },
      select: { id: true },
      take: 200,
    });

    for (const session of stale) {
      await closeSession(session.id, "inactivity");
    }

    return stale.length;
  } catch {
    return 0;
  }
}

export async function startOrResumeSession(params: {
  userId: string;
  centerId: string;
  userAgent?: string | null;
}): Promise<{ sessionId: string; resumed: boolean }> {
  const { userId, centerId } = params;

  const open = await prisma.userSession.findFirst({
    where: { userId, centerId, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, lastActivityAt: true },
  });

  const now = new Date();
  const isStale = open ? now.getTime() - open.lastActivityAt.getTime() > INACTIVITY_MS : true;

  if (open && !isStale) {
    await prisma.userSession.update({
      where: { id: open.id },
      data: { lastActivityAt: now },
    });
    await prisma.utilisateur
      .update({ where: { id: userId }, data: { lastSeenAt: now } })
      .catch(() => {});
    return { sessionId: open.id, resumed: true };
  }

  if (open && isStale) {
    await closeSession(open.id, "inactivity");
  }

  const created = await prisma.userSession.create({
    data: {
      userId,
      centerId,
      startedAt: now,
      lastActivityAt: now,
    },
    select: { id: true },
  });

  await prisma.utilisateur
    .update({ where: { id: userId }, data: { lastSeenAt: now } })
    .catch(() => {});

  void trackEventSafe({
    userId,
    centerId,
    sessionId: created.id,
    event: "SESSION_STARTED",
    path: "/",
    userAgent: params.userAgent ?? null,
  });

  return { sessionId: created.id, resumed: false };
}

export async function touchSession(sessionId: string, userId: string): Promise<void> {
  try {
    const now = new Date();
    const updated = await prisma.userSession.updateMany({
      where: { id: sessionId, userId, endedAt: null },
      data: { lastActivityAt: now },
    });

    if (updated.count > 0) {
      await prisma.utilisateur
        .update({ where: { id: userId }, data: { lastSeenAt: now } })
        .catch(() => {});
    }
  } catch {}
}

export async function endSession(params: {
  userId: string;
  centerId: string;
  sessionId?: string | null;
  reason?: SessionEndReason;
}): Promise<void> {
  const reason = params.reason ?? "logout";

  try {
    if (params.sessionId) {
      await closeSession(params.sessionId, reason);
      await trackEventSafe({
        userId: params.userId,
        centerId: params.centerId,
        sessionId: params.sessionId,
        event: "SESSION_ENDED",
        path: "/",
        metadata: { reason },
      });
      return;
    }

    const open = await prisma.userSession.findMany({
      where: { userId: params.userId, centerId: params.centerId, endedAt: null },
      select: { id: true },
    });

    for (const session of open) {
      await closeSession(session.id, reason);
    }
  } catch {}
}

const FEATURE_RULES: Array<[RegExp, string]> = [
  [/^\/(admin|eleve|prof)\/finances/, "Finances"],
  [/^\/(admin|eleve|prof)\/finances-professeurs/, "Finances Profs"],
  [/^\/(admin|eleve|prof)\/benefices/, "Bénéfices"],
  [/^\/(admin|eleve|prof)\/paiements/, "Paiements"],
  [/^\/(admin|eleve|prof)\/presences/, "Présences"],
  [/^\/(admin|eleve|prof)\/eleves/, "Élèves"],
  [/^\/(admin|eleve|prof)\/professeurs/, "Professeurs"],
  [/^\/(admin|eleve|prof)\/groupes/, "Groupes"],
  [/^\/(admin|eleve|prof)\/seances/, "Séances"],
  [/^\/(admin|eleve|prof)\/notifications/, "Notifications"],
  [/^\/(admin|eleve|prof)\/backup/, "Sauvegardes"],
  [/^\/(admin|eleve|prof)\/parametres/, "Paramètres"],
  [/^\/(admin|eleve|prof)\/matieres/, "Matières"],
  [/^\/(admin|eleve|prof)\/utilisateurs/, "Utilisateurs"],
  [/^\/super-admin/, "Analytics Plateforme"],
  [/^\/(admin|eleve|prof|profil|compte)$/, "Profil"],
];

export function featureFromPath(path?: string | null): string {
  if (!path) return "Autre";
  const clean = path.split("?")[0];

  for (const [pattern, feature] of FEATURE_RULES) {
    if (pattern.test(clean)) return feature;
  }

  if (/^\/(admin|eleve|prof)$/.test(clean)) return "Dashboard";
  if (clean.startsWith("/api/")) return "API";

  return "Autre";
}

export const FEATURE_LABELS: Record<string, string> = {
  Dashboard: "Dashboard",
  Presences: "Présences",
  Eleves: "Élèves",
  "Élèves": "Élèves",
  Finances: "Finances",
  "Finances Profs": "Finances",
  Paiements: "Paiements",
  Benefices: "Bénéfices",
  "Bénéfices": "Bénéfices",
  Groupes: "Groupes",
  Seances: "Séances",
  "Séances": "Séances",
  Notifications: "Notifications",
  Assistant: "Assistant IA",
  Profil: "Profil",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

export { HEARTBEAT_INTERVAL_MS };
