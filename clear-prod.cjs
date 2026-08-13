const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is required (set it in the environment or a local .env).");
  process.exit(1);
}

if (process.env.CONFIRM_DESTRUCTIVE !== '1') {
  console.error("ERROR: this script DELETES PRODUCTION DATA. Set CONFIRM_DESTRUCTIVE=1 to run.");
  process.exit(1);
}

const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

(async () => {
  await p.presence.deleteMany(); console.log('cleared presences');
  await p.paiement.deleteMany(); console.log('cleared paiements');
  await p.inscription.deleteMany(); console.log('cleared inscriptions');
  await p.seance.deleteMany(); console.log('cleared seances');
  await p.notification.deleteMany(); console.log('cleared notifications');
  await p.groupe.deleteMany(); console.log('cleared groupes');
  await p.matiere.deleteMany(); console.log('cleared matieres');
  await p.utilisateur.deleteMany({ where: { role: { not: 'super_admin' } } }); console.log('cleared users (kept super_admin)');
  await p.center.deleteMany({ where: { slug: { not: 'default' } } }); console.log('cleared centers (kept default)');
  console.log('All data cleared!');
  await p.$disconnect();
})();
