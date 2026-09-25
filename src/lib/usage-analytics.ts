import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const SUPER_ADMIN_ROLES = ["super_admin"];

export function n(v: unknown): number {
  return Number(v ?? 0);
}

export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id || !SUPER_ADMIN_ROLES.includes(user.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Non autorisé" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

export function resolveRange(
  range: string | null,
  fromRaw: string | null,
  toRaw: string | null
): { from: Date; to: Date; previousFrom: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = new Date(now);

  if (range === "custom" && fromRaw && toRaw) {
    const customFrom = new Date(`${fromRaw}T00:00:00`);
    const customTo = new Date(`${toRaw}T23:59:59`);
    if (!Number.isNaN(customFrom.getTime()) && !Number.isNaN(customTo.getTime())) {
      return { from: customFrom, to: customTo, previousFrom: customFrom };
    }
  }

  switch (range) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "30d":
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      from.setHours(0, 0, 0, 0);
      break;
    case "7d":
    default:
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
  }

  const span = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - span);

  return { from, to, previousFrom };
}

export function centerClause(centerFilter: string | null) {
  return centerFilter ? Prisma.sql`AND center_id = ${centerFilter}::uuid` : Prisma.empty;
}

export function userCenterClause(centerFilter: string | null) {
  return centerFilter ? Prisma.sql`AND u.center_id = ${centerFilter}::uuid` : Prisma.empty;
}

export async function countDistinctActiveUsers(
  since: Date,
  centerFilter: string | null
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT user_id)::bigint AS count
    FROM analytics_events
    WHERE created_at >= ${since}
      ${centerFilter ? Prisma.sql`AND center_id = ${centerFilter}::uuid` : Prisma.empty}
  `);
  return n(rows[0]?.count);
}

export type UsageOverview = {
  from: Date;
  to: Date;
  previousFrom: Date;
  centerFilter: string | null;
  overview: Record<string, number>;
  deltas: Record<string, number>;
  daily: Array<{ day: string; users: number; events: number }>;
  features: Array<{ feature: string; count: number; uniqueUsers: number; percentage: number }>;
  pages: Array<{ path: string; count: number; uniqueUsers: number; percentage: number }>;
  roles: Array<{
    role: string;
    sessions: number;
    events: number;
    uniqueUsers: number;
    averageDurationSeconds: number;
  }>;
  centers: Array<{
    centerId: string;
    centerName: string;
    users: number;
    events: number;
    sessions: number;
  }>;
  byEvent: Array<{ event: string; count: number }>;
  journeys: Array<{ userId: string; path: string[]; events: number }>;
  insights: Record<string, unknown>;
};

export async function getUsageOverview(params: {
  from: Date;
  to: Date;
  previousFrom: Date;
  centerFilter: string | null;
}): Promise<UsageOverview> {
  const { from, to, previousFrom, centerFilter } = params;

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const start7d = new Date(startToday);
  start7d.setDate(start7d.getDate() - 6);
  const start30d = new Date(startToday);
  start30d.setDate(start30d.getDate() - 29);

  const [
    activeToday,
    active7d,
    active30d,
    activePrevious,
    totalEvents,
    previousEvents,
    sessions,
    previousSessions,
    totalUsers,
    featureGroups,
    pageGroups,
    roleRows,
    centerRows,
    dailyRows,
    eventGroups,
    journeyRows,
  ] = await Promise.all([
    countDistinctActiveUsers(startToday, centerFilter),
    countDistinctActiveUsers(start7d, centerFilter),
    countDistinctActiveUsers(start30d, centerFilter),
    countDistinctActiveUsers(previousFrom, centerFilter),
    prisma.analyticsEvent.count({
      where: {
        ...(centerFilter ? { centerId: centerFilter } : {}),
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.analyticsEvent.count({
      where: {
        ...(centerFilter ? { centerId: centerFilter } : {}),
        createdAt: { gte: previousFrom, lt: from },
      },
    }),
    prisma.userSession.aggregate({
      where: {
        ...(centerFilter ? { centerId: centerFilter } : {}),
        startedAt: { gte: from, lte: to },
      },
      _count: { _all: true },
      _avg: { durationSeconds: true },
    }),
    prisma.userSession.aggregate({
      where: {
        ...(centerFilter ? { centerId: centerFilter } : {}),
        startedAt: { gte: previousFrom, lt: from },
      },
      _count: { _all: true },
    }),
    prisma.utilisateur.count({ where: { deletedAt: null, ghost: false } }),
    prisma.$queryRaw<Array<{ feature: string | null; count: bigint; users: bigint }>>(Prisma.sql`
      SELECT COALESCE(feature, 'Autre') AS feature,
             COUNT(*)::bigint AS count,
             COUNT(DISTINCT user_id)::bigint AS users
      FROM analytics_events
      WHERE created_at >= ${from} AND created_at <= ${to}
        ${centerClause(centerFilter)}
      GROUP BY COALESCE(feature, 'Autre')
      ORDER BY count DESC
      LIMIT 20
    `),
    prisma.$queryRaw<Array<{ path: string | null; count: bigint; users: bigint }>>(Prisma.sql`
      SELECT path, COUNT(*)::bigint AS count, COUNT(DISTINCT user_id)::bigint AS users
      FROM analytics_events
      WHERE event = 'PAGE_VIEW'::"AnalyticsEventName"
        AND created_at >= ${from} AND created_at <= ${to}
        AND path IS NOT NULL
        ${centerClause(centerFilter)}
      GROUP BY path
      ORDER BY count DESC
      LIMIT 25
    `),
    prisma.$queryRaw<
      Array<{ role: string; sessions: bigint; duration: bigint; events: bigint; users: bigint }>
    >(Prisma.sql`
      SELECT u.role,
             COUNT(DISTINCT s.id)::bigint AS sessions,
             COALESCE(SUM(s.duration_seconds), 0)::bigint AS duration,
             COUNT(DISTINCT e.id)::bigint AS events,
             COUNT(DISTINCT e.user_id)::bigint AS users
      FROM utilisateurs u
      LEFT JOIN user_sessions s
        ON s.user_id = u.id AND s.started_at >= ${from} AND s.started_at <= ${to}
      LEFT JOIN analytics_events e
        ON e.user_id = u.id AND e.created_at >= ${from} AND e.created_at <= ${to}
      WHERE u.deleted_at IS NULL
        ${userCenterClause(centerFilter)}
      GROUP BY u.role
      ORDER BY events DESC
    `),
    prisma.$queryRaw<
      Array<{
        center_id: string;
        center_name: string;
        users: bigint;
        events: bigint;
        sessions: bigint;
      }>
    >(Prisma.sql`
      SELECT c.id AS center_id, c.name AS center_name,
             COUNT(DISTINCT e.user_id)::bigint AS users,
             COUNT(DISTINCT e.id)::bigint AS events,
             COUNT(DISTINCT s.id)::bigint AS sessions
      FROM centers c
      LEFT JOIN analytics_events e
        ON e.center_id = c.id AND e.created_at >= ${from} AND e.created_at <= ${to}
      LEFT JOIN user_sessions s
        ON s.center_id = c.id AND s.started_at >= ${from} AND s.started_at <= ${to}
      GROUP BY c.id, c.name
      ORDER BY events DESC
    `),
    prisma.$queryRaw<Array<{ day: Date; users: bigint; events: bigint }>>(Prisma.sql`
      SELECT DATE_TRUNC('day', created_at) AS day,
             COUNT(DISTINCT user_id)::bigint AS users,
             COUNT(*)::bigint AS events
      FROM analytics_events
      WHERE created_at >= ${from} AND created_at <= ${to}
        ${centerClause(centerFilter)}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day ASC
    `),
    prisma.analyticsEvent.groupBy({
      by: ["event"],
      where: {
        ...(centerFilter ? { centerId: centerFilter } : {}),
        createdAt: { gte: from, lte: to },
      },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ user_id: string; path: string | null; count: bigint }>>(Prisma.sql`
      SELECT user_id, path, COUNT(*)::bigint AS count
      FROM analytics_events
      WHERE event = 'PAGE_VIEW'::"AnalyticsEventName"
        AND created_at >= ${from} AND created_at <= ${to}
        AND path IS NOT NULL
        ${centerClause(centerFilter)}
      GROUP BY user_id, path
      ORDER BY user_id, count DESC
      LIMIT 4000
    `),
  ]);

  const totalFeatureEvents = featureGroups.reduce((acc, f) => acc + n(f.count), 0);
  const features = featureGroups.map((f) => ({
    feature: f.feature ?? "Autre",
    count: n(f.count),
    uniqueUsers: n(f.users),
    percentage: totalFeatureEvents > 0 ? (n(f.count) / totalFeatureEvents) * 100 : 0,
  }));

  const totalPageViews = pageGroups.reduce((acc, p) => acc + n(p.count), 0);
  const pages = pageGroups.map((p) => ({
    path: p.path ?? "/",
    count: n(p.count),
    uniqueUsers: n(p.users),
    percentage: totalPageViews > 0 ? (n(p.count) / totalPageViews) * 100 : 0,
  }));

  const roles = roleRows.map((r) => ({
    role: r.role,
    sessions: n(r.sessions),
    events: n(r.events),
    uniqueUsers: n(r.users),
    averageDurationSeconds: n(r.sessions) > 0 ? Math.round(n(r.duration) / n(r.sessions)) : 0,
  }));

  const centers = centerRows.map((c) => ({
    centerId: c.center_id,
    centerName: c.center_name,
    users: n(c.users),
    events: n(c.events),
    sessions: n(c.sessions),
  }));

  const daily = dailyRows.map((d) => ({
    day: d.day.toISOString().slice(0, 10),
    users: n(d.users),
    events: n(d.events),
  }));

  const byEvent = eventGroups
    .map((e) => ({ event: String(e.event), count: n(e._count._all) }))
    .sort((a, b) => b.count - a.count);

  const byUser = new Map<string, string[]>();
  for (const row of journeyRows) {
    const list = byUser.get(row.user_id) ?? [];
    if (list.length < 8) list.push(row.path ?? "/");
    byUser.set(row.user_id, list);
  }
  const journeys = Array.from(byUser.entries())
    .slice(0, 20)
    .map(([userId, path]) => ({ userId, path, events: 0 }));

  const avgDurationSeconds = Math.round(n(sessions._avg.durationSeconds));
  const totalSessions = n(sessions._count._all);
  const previousSessionCount = n(previousSessions._count._all);
  const previousEventCount = n(previousEvents);

  const mostUsed = features.length > 0 ? features[0] : null;
  const leastUsed = features.length > 0 ? features[features.length - 1] : null;
  const busiestDay =
    daily.length > 0 ? daily.reduce((a, b) => (b.events > a.events ? b : a)) : null;

  const percentChange = (current: number, previous: number) =>
    previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

  return {
    from,
    to,
    previousFrom,
    centerFilter,
    overview: {
      activeUsersToday: activeToday,
      activeUsers7d: active7d,
      activeUsers30d: active30d,
      activeUsersPrevious: activePrevious,
      totalSessions,
      averageSessionDurationSeconds: avgDurationSeconds,
      totalEvents,
      totalUsers,
      dauMauRatio: active30d > 0 ? (activeToday / active30d) * 100 : 0,
    },
    deltas: {
      events: percentChange(totalEvents, previousEventCount),
      sessions: percentChange(totalSessions, previousSessionCount),
      activeUsers: percentChange(active30d, activePrevious),
    },
    daily,
    features,
    pages,
    roles,
    centers,
    byEvent,
    journeys,
    insights: {
      mostUsedFeature: mostUsed,
      leastUsedFeature: leastUsed,
      averageSessionDurationSeconds: avgDurationSeconds,
      activeUserRate: totalUsers > 0 ? (active30d / totalUsers) * 100 : 0,
      topRole: roles[0]?.role ?? null,
      busiestDay,
      unusedFeatures: features.filter((f) => f.count === 0).map((f) => f.feature),
    },
  };
}
