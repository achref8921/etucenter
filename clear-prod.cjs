const { PrismaClient } = require('@prisma/client');
const DATABASE_URL = "postgresql://neondb_owner:npg_MI5QSKHnzZT3@ep-sweet-frost-axfip50d.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";
const p = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

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
