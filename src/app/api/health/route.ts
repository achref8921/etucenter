import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function GET() {
  const t0 = Date.now();
  let dbStatus: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json(
    {
      status: dbStatus === "ok" ? "ok" : "error",
      service: "gestexam",
      database: dbStatus,
      responseTimeMs: Date.now() - t0,
      time: new Date().toISOString(),
    },
    { status: dbStatus === "ok" ? 200 : 503 }
  );
}
