import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  endSession,
  featureFromPath,
  startOrResumeSession,
  touchSession,
  trackEventSafe,
} from "@/lib/analytics";
import { AnalyticsEventName } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS: AnalyticsEventName[] = [
  "SESSION_STARTED",
  "SESSION_ENDED",
  "PAGE_VIEW",
  "STUDENT_VIEWED",
  "STUDENT_CREATED",
  "STUDENT_UPDATED",
  "GROUP_VIEWED",
  "GROUP_CREATED",
  "GROUP_UPDATED",
  "ATTENDANCE_VIEWED",
  "ATTENDANCE_MARKED",
  "PAYMENT_VIEWED",
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_DELETED",
  "REPORT_EXPORTED",
  "NOTIFICATION_VIEWED",
  "ASSISTANT_USED",
];

function isAllowedEvent(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && (ALLOWED_EVENTS as string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = String(user.id);
    const centerId = user.centerId ? String(user.centerId) : null;

    if (!centerId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const action = typeof body.action === "string" ? body.action : "event";
    const userAgent = request.headers.get("user-agent");

    if (action === "start") {
      const result = await startOrResumeSession({ userId, centerId, userAgent });
      return NextResponse.json({ ok: true, sessionId: result.sessionId });
    }

    const requestedSessionId = body.sessionId ? String(body.sessionId) : null;
    let sessionId: string | null = null;

    if (requestedSessionId) {
      const owned = await prisma.userSession.findFirst({
        where: { id: requestedSessionId, userId, endedAt: null },
        select: { id: true },
      });
      sessionId = owned ? owned.id : null;
    }

    if (action === "end") {
      const allowedReasons = ["logout", "unload", "manual"] as const;
      const rawReason = typeof body.reason === "string" ? body.reason : "logout";
      const reason = (allowedReasons as readonly string[]).includes(rawReason)
        ? (rawReason as (typeof allowedReasons)[number])
        : "logout";
      await endSession({
        userId,
        centerId,
        sessionId,
        reason,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "heartbeat") {
      if (sessionId) await touchSession(sessionId, userId);
      return NextResponse.json({ ok: true });
    }

    if (action === "page_view") {
      const path = typeof body.path === "string" ? body.path : null;
      if (sessionId) await touchSession(sessionId, userId);
      await trackEventSafe({
        userId,
        centerId,
        sessionId,
        event: "PAGE_VIEW",
        path,
        feature: featureFromPath(path),
        metadata: { source: typeof body.source === "string" ? body.source : "navigate" },
        userAgent,
      });
      return NextResponse.json({ ok: true });
    }

    if (isAllowedEvent(body.event)) {
      const path = typeof body.path === "string" ? body.path : null;
      if (sessionId) await touchSession(sessionId, userId);
      await trackEventSafe({
        userId,
        centerId,
        sessionId,
        event: body.event,
        path,
        feature: typeof body.feature === "string" ? body.feature : featureFromPath(path),
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Prisma.InputJsonObject)
            : null,
        userAgent,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Événement invalide" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: true, skipped: true });
  }
}
