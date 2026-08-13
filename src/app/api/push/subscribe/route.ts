import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveCenter } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const userId = (session.user as any).id;

    const body = await request.json();
    const { endpoint, keys } = body || {};

    if (
      typeof endpoint !== "string" ||
      endpoint.length > 1000 ||
      !keys ||
      typeof keys.p256dh !== "string" ||
      typeof keys.auth !== "string"
    ) {
      return NextResponse.json({ error: "Subscription invalide" }, { status: 400 });
    }

    const userAgent =
      request.headers.get("user-agent")?.slice(0, 255) || null;

    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      update: { p256dh: keys.p256dh, auth: keys.auth, userAgent },
      create: {
        centerId,
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter(request.method);
    if (error) return error;

    const userId = (session.user as any).id;
    const body = await request.json().catch(() => ({}));
    const { endpoint } = body || {};

    if (typeof endpoint === "string") {
      await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    } else {
      await prisma.pushSubscription.deleteMany({ where: { userId } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
