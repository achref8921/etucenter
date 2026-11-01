import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getProfDashboardStats,
  getProfUpcomingSeances,
} from "@/lib/prof-dashboard-data";
import { getStudentsOverGroupPrice } from "@/lib/students-over-group-price";
import { SkeletonPage } from "@/components/ui/skeleton";
import ProfDashboardClient from "@/components/prof/prof-dashboard-client";

async function ProfDashboardContent() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; role?: string; centerId?: string; prenom?: string }
    | undefined;

  if (!user?.id) {
    redirect("/login");
  }

  if (user.role !== "prof" || !user.centerId) {
    redirect("/");
  }

  const [stats, upcomingSeances, exceedingStudents] = await Promise.all([
    getProfDashboardStats(user.id, user.centerId),
    getProfUpcomingSeances(user.id, user.centerId),
    getStudentsOverGroupPrice({ centerId: user.centerId, profId: user.id }),
  ]);

  return (
    <ProfDashboardClient
      prenom={user.prenom ?? "Prof"}
      stats={stats}
      upcomingSeances={upcomingSeances}
      exceedingStudents={exceedingStudents}
    />
  );
}

export default function ProfDashboardPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <ProfDashboardContent />
    </Suspense>
  );
}
