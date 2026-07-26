import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SuperAdminLayout from "@/components/layout/super-admin-layout";

export default async function SuperAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if ((session.user as any).role !== "super_admin") {
    const role = (session.user as any).role;
    if (role === "admin") redirect("/admin");
    if (role === "prof") redirect("/prof");
    if (role === "eleve") redirect("/eleve");
    redirect("/login");
  }

  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}
