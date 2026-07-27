import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayoutClient from "@/components/layout/dashboard-layout";
import type { SessionUser } from "@/types";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;

  if (role === "super_admin") {
    return <>{children}</>;
  }

  const centerId = (session.user as any).centerId;

  let centerName = "GestExam";
  let centerLogo: string | null = null;

  if (centerId) {
    const center = await prisma.center.findUnique({
      where: { id: centerId },
      select: { name: true, logo: true, active: true },
    });
    if (!center || !center.active) {
      redirect("/centre-suspendu");
    }
    centerName = center.name;
    centerLogo = center.logo;
  }

  const user: SessionUser = {
    id: session.user.id,
    nom: session.user.nom,
    prenom: session.user.prenom,
    role: session.user.role as SessionUser["role"],
    email: session.user.email ?? "",
    centerId: session.user.centerId,
  };

  return (
    <DashboardLayoutClient user={user} centerName={centerName} centerLogo={centerLogo}>
      {children}
    </DashboardLayoutClient>
  );
}
