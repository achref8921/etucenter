import { NextResponse } from "next/server";
import os from "node:os";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function GET() {
  const t0 = Date.now();
  let dbStatus: "ok" | "error" = "error";
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(
    {
      status: dbStatus === "ok" ? "ok" : "error",
      service: "gestexam",
      uptimeSec: Math.round(process.uptime()),
      region: process.env.VERCEL_REGION || null,
      node: process.version,
      platform: process.platform,
      hostname: os.hostname(),
      database: dbStatus,
      databaseError: dbError,
      responseTimeMs: Date.now() - t0,
      time: new Date().toISOString(),
    },
    { status: dbStatus === "ok" ? 200 : 503 }
  );
}
