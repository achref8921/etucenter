import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export async function GET(req: NextRequest, ctx: { params: Promise<unknown> }) {
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<unknown> }) {
  return handler(req, ctx);
}
