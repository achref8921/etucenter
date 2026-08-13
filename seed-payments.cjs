const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is required (set it in the environment or a local .env).");
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  await prisma.$connect();
  console.log("Connected! Creating payments...");

  const allGroupes = await prisma.groupe.findMany();
  const allInscriptions = await prisma.inscription.findMany();
  const today = new Date();
  let payCount = 0;

  for (const grp of allGroupes) {
    const gi = allInscriptions.filter(i => i.groupeId === grp.id);
    for (const ins of gi) {
      for (let m = 0; m < 4; m++) {
        if (Math.random() > 0.1) {
          const d = new Date(today);
          d.setMonth(d.getMonth() - m);
          try {
            await prisma.paiement.create({
              data: {
                eleveId: ins.eleveId,
                groupeId: grp.id,
                montant: Number(grp.prixParSeance),
                methodePaiement: Math.random() > 0.5 ? "especes" : "virement",
                datePaiement: d,
              },
            });
            payCount++;
          } catch {}
        }
      }
    }
  }
  console.log(`✅ Paiements: ${payCount}`);
  console.log("\n🎉 SEED COMPLET!");
  console.log("📧 Super Admin: superadmin@test.com / 123456");
  console.log("📧 Admins: admin@ghodhbeni.com, admin@centre-el-fath.com, admin@centre-ennour.com / 123456");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
