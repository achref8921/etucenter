import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { n, requireSuperAdmin, resolveRange } from "@/lib/usage-analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? "25")));
    const search = (searchParams.get("search") ?? "").trim();
    const role = searchParams.get("role") || null;
    const centerId = searchParams.get("centerId") || null;
    const active = searchParams.get("active");

    const { from, to } = resolveRange(
      searchParams.get("range"),
      searchParams.get("from"),
      searchParams.get("to")
    );

    const since = new Date(from);

    const where: Prisma.UtilisateurWhereInput = {
      deletedAt: null,
      ghost: false,
      ...(role ? { role: role as any } : {}),
      ...(centerId ? { centerId } : {}),
      ...(active === "active" ? { lastSeenAt: { gte: since } } : {}),
      ...(active === "inactive" ? { OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: since } }] } : {}),
      ...(search
        ? {
            OR: [
              { nom: { contains: search, mode: "insensitive" } },
              { prenom: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.utilisateur.count({ where }),
      prisma.utilisateur.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          role: true,
          lastSeenAt: true,
          center: { select: { id: true, name: true } },
        },
        orderBy: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { nom: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const userIds = users.map((u) => u.id);
    const idList = Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`));

    const [sessionAgg, activeDayRows, topFeatureRows] = await Promise.all([
      userIds.length > 0
        ? prisma.userSession.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds }, startedAt: { gte: from, lte: to } },
            _count: { _all: true },
            _sum: { durationSeconds: true },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? prisma.$queryRaw<Array<{ user_id: string; days: bigint }>>(Prisma.sql`
            SELECT user_id, COUNT(DISTINCT DATE_TRUNC('day', created_at))::bigint AS days
            FROM analytics_events
            WHERE user_id IN (${idList})
              AND created_at >= ${from} AND created_at <= ${to}
            GROUP BY user_id
          `)
        : Promise.resolve([]),
      userIds.length > 0
        ? prisma.$queryRaw<Array<{ user_id: string; feature: string | null; count: bigint }>>(Prisma.sql`
            SELECT user_id, feature, COUNT(*)::bigint AS count
            FROM analytics_events
            WHERE user_id IN (${idList})
              AND created_at >= ${from} AND created_at <= ${to}
            GROUP BY user_id, feature
            ORDER BY user_id, count DESC
          `)
        : Promise.resolve([]),
    ]);

    const sessionsByUser = new Map(
      sessionAgg.map((s) => [
        s.userId,
        { sessions: n(s._count._all), duration: n(s._sum.durationSeconds) },
      ])
    );
    const daysByUser = new Map(activeDayRows.map((r) => [r.user_id, n(r.days)]));

    const featureByUser = new Map<string, { feature: string; count: number }>();
    for (const row of topFeatureRows) {
      if (featureByUser.has(row.user_id)) continue;
      featureByUser.set(row.user_id, { feature: row.feature ?? "Autre", count: n(row.count) });
    }

    return NextResponse.json({
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      users: users.map((u) => {
        const agg = sessionsByUser.get(u.id) ?? { sessions: 0, duration: 0 };
        return {
          id: u.id,
          nom: u.nom,
          prenom: u.prenom,
          email: u.email,
          role: u.role,
          lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
          centerId: u.center.id,
          centerName: u.center.name,
          sessions: agg.sessions,
          activeDays: daysByUser.get(u.id) ?? 0,
          totalUsageSeconds: agg.duration,
          topFeature: featureByUser.get(u.id)?.feature ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("Super admin usage users error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
