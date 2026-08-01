import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "superadmin@test.com";
  const password = "123456";
  const hashed = await bcrypt.hash(password, 10);

  // Create a default center for super admin
  const center = await prisma.center.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Centre Par Défaut",
      slug: "default",
      code: "DEFAULT",
      phone: "+216 00 00 00 00",
      address: "Tunis, Tunisie",
      active: true,
    },
  });

  console.log("Center:", center.id);

  const user = await prisma.utilisateur.upsert({
    where: { email },
    update: {},
    create: {
      centerId: center.id,
      nom: "Admin",
      prenom: "Super",
      email,
      motDePasse: hashed,
      role: "super_admin",
      actif: true,
    },
  });

  console.log("Super Admin created:", user.email);
  console.log("Login: superadmin@test.com / 123456");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
