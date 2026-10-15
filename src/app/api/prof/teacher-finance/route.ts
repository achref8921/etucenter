import { NextRequest, NextResponse } from "next/server";
import { requireActiveCenter, PROF_ROLES } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { getTeacherDashboardFinance, listTeacherTransactions, getTeacherProfit, monthRange } from "@/lib/teacher-finance";

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveCenter("GET", PROF_ROLES);
    if (error) return error;

    const userId = (session.user as any).id;
    const centerId = (session.user as any).centerId;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const month = searchParams.get("month") || undefined;
    const page = Number(searchParams.get("page") ?? "1");

    const range = monthRange(month);
    const listFrom = fromRaw ? new Date(`${fromRaw}T00:00:00`) : month ? range.from : undefined;
    const listTo = toRaw ? new Date(`${toRaw}T23:59:59`) : month ? range.to : undefined;

    const [ledger, finance, profit] = await Promise.all([
      listTeacherTransactions({ centerId, teacherId: userId, from: listFrom, to: listTo, type, page }),
      getTeacherDashboardFinance(centerId, userId),
      getTeacherProfit({ centerId, teacherId: userId, from: range.from, to: range.to }),
    ]);

    return NextResponse.json({
      transactions: ledger.items,
      total: ledger.total,
      page: ledger.page,
      pageSize: ledger.pageSize,
      totalPages: ledger.totalPages,
      balance: finance.claimable,
      claimable: finance.claimable,
      impayeNet: finance.impayeNet,
      profit,
      month,
    });
  } catch (error) {
    logger.error("Erreur lors de la récupération du compte professeur", { error });
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
