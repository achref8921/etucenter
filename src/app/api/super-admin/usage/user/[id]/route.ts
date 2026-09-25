import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { featureLabel } from "@/lib/analytics";
import { n, requireSuperAdmin, resolveRange } from "@/lib/usage-analytics";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { from, to } = resolveRange(
      searchParams.get("range"),
      searchParams.get("from"),
      searchParams.get("to")
    );

    const user = await prisma.utilisateur.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        lastSeenAt: true,
        createdAt: true,
        center: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const [sessionAgg, sessionCount, dayRows, featureRows, pageRows, recent, sessionList] =
      await Promise.all([
        prisma.userSession.aggregate({
          where: { userId: id, startedAt: { gte: from, lte: to } },
          _count: { _all: true },
          _sum: { durationSeconds: true },
          _avg: { durationSeconds: true },
        }),
        prisma.userSession.count({ where: { userId: id } }),
        prisma.$queryRaw<Array<{ days: bigint }>>(Prisma.sql`
          SELECT COUNT(DISTINCT DATE_TRUNC('day', created_at))::bigint AS days
          FROM analytics_events
          WHERE user_id = ${id}::uuid AND created_at >= ${from} AND created_at <= ${to}
        `),
        prisma.$queryRaw<Array<{ feature: string | null; count: bigint }>>(Prisma.sql`
          SELECT feature, COUNT(*)::bigint AS count
          FROM analytics_events
          WHERE user_id = ${id}::uuid AND created_at >= ${from} AND created_at <= ${to}
          GROUP BY feature
          ORDER BY count DESC
          LIMIT 10
        `),
        prisma.$queryRaw<Array<{ path: string | null; count: bigint }>>(Prisma.sql`
          SELECT path, COUNT(*)::bigint AS count
          FROM analytics_events
          WHERE user_id = ${id}::uuid
            AND event = 'PAGE_VIEW'::"AnalyticsEventName"
            AND created_at >= ${from} AND created_at <= ${to}
            AND path IS NOT NULL
          GROUP BY path
          ORDER BY count DESC
          LIMIT 10
        `),
        prisma.analyticsEvent.findMany({
          where: { userId: id, createdAt: { gte: from, lte: to } },
          select: {
            id: true,
            event: true,
            path: true,
            feature: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
        prisma.userSession.findMany({
          where: { userId: id },
          select: {
            id: true,
            startedAt: true,
            lastActivityAt: true,
            endedAt: true,
            durationSeconds: true,
            endReason: true,
          },
          orderBy: { startedAt: "desc" },
          take: 20,
        }),
      ]);

    const journeyRows = await prisma.$queryRaw<Array<{ path: string | null }>>(Prisma.sql`
      SELECT path
      FROM analytics_events
      WHERE user_id = ${id}::uuid
        AND event = 'PAGE_VIEW'::"AnalyticsEventName"
        AND created_at >= ${from} AND created_at <= ${to}
        AND path IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 40
    `);

    const journey: string[] = [];
    for (const row of journeyRows) {
      const p = row.path ?? "/";
      if (journey.length === 0 || journey[journey.length - 1] !== p) journey.push(p);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
        centerId: user.center.id,
        centerName: user.center.name,
      },
      stats: {
        sessions: n(sessionAgg._count._all),
        totalSessions: sessionCount,
        totalUsageSeconds: n(sessionAgg._sum.durationSeconds),
        averageSessionDurationSeconds: Math.round(n(sessionAgg._avg.durationSeconds)),
        activeDays: n(dayRows[0]?.days),
      },
      topFeatures: featureRows.map((r) => ({
        feature: featureLabel(r.feature ?? "Autre"),
        count: n(r.count),
      })),
      topPages: pageRows.map((r) => ({ path: r.path ?? "/", count: n(r.count) })),
      journey: journey.slice(0, 12),
      recentActivity: recent.map((r) => ({
        id: r.id,
        event: String(r.event),
        path: r.path,
        feature: r.feature,
        createdAt: r.createdAt.toISOString(),
      })),
      sessionHistory: sessionList.map((s) => ({
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        lastActivityAt: s.lastActivityAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        durationSeconds: s.durationSeconds,
        endReason: s.endReason,
      })),
    });
  } catch (error) {
    console.error("Super admin usage user detail error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
