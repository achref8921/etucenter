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

    // Un appareil = un seul compte recevant les pushes. Sans cette purge, un
    // téléphone ayant servi plusieurs comptes gardait une ligne par compte sur
    // LE MÊME endpoint et chacun recevait les notifications des autres.
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: { not: userId } },
    });

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
    const body = await request.json().catch(() => ({}));
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;

    const { session, error } = await requireActiveCenter(request.method);

    if (session) {
      const userId = (session.user as any).id;
      await prisma.pushSubscription.deleteMany({
        where: endpoint ? { userId, endpoint } : { userId },
      });
      return NextResponse.json({ success: true });
    }

    // Pas de session (déconnexion / service worker) : l'endpoint est un secret
    // cryptographique connu du seul appareil concerné, il suffit à identifier
    // la ligne à retirer. Sans lui, aucune suppression possible.
    if (endpoint && endpoint.length <= 1000) {
      await prisma.pushSubscription.deleteMany({
        where: targetUserId ? { endpoint, userId: targetUserId } : { endpoint },
      });
      return NextResponse.json({ success: true });
    }

    return error ?? NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
