import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, ELEVE_ROLES } from "@/lib/auth-helpers";
import {
  getStudentBalance,
  listStudentTransactions,
} from "@/lib/student-finance";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", ELEVE_ROLES);
    if (error) return error;

    const centerId = (session.user as any).centerId;
    const eleveId = (session.user as any).id;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const page = Number(searchParams.get("page") ?? "1");

    const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : undefined;
    const to = toRaw ? new Date(`${toRaw}T23:59:59`) : undefined;

    const [ledger, balance] = await Promise.all([
      listStudentTransactions({ centerId, eleveId, from, to, type, page }),
      getStudentBalance(centerId, eleveId),
    ]);

    return NextResponse.json({
      transactions: ledger.items,
      total: ledger.total,
      page: ledger.page,
      pageSize: ledger.pageSize,
      totalPages: ledger.totalPages,
      balance,
      filters: { type, from: fromRaw ?? null, to: toRaw ?? null },
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
