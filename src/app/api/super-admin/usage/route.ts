import { NextRequest, NextResponse } from "next/server";
import { sweepStaleSessions } from "@/lib/analytics";
import { getUsageOverview, requireSuperAdmin, resolveRange } from "@/lib/usage-analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const centerFilter = searchParams.get("centerId") || null;
    const { from, to, previousFrom } = resolveRange(
      searchParams.get("range"),
      searchParams.get("from"),
      searchParams.get("to")
    );

    void sweepStaleSessions();

    const data = await getUsageOverview({ from, to, previousFrom, centerFilter });

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      overview: data.overview,
      deltas: data.deltas,
      daily: data.daily,
      features: data.features,
      pages: data.pages,
      roles: data.roles,
      centers: data.centers,
      byEvent: data.byEvent,
      journeys: data.journeys,
      insights: data.insights,
    });
  } catch (error) {
    console.error("Super admin usage analytics error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
