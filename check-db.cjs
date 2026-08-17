const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const students = await prisma.user.findMany({where: {role: 'ELEVE'}, select: {id:true, nom:true, prenom:true, email:true}, take: 10});
    console.log('Students:', JSON.stringify(students, null, 2));
    
    const paiements = await prisma.paiement.findMany({select: {id:true, montant:true, statut:true, eleveId:true, groupeId:true}});
    console.log('Paiements:', JSON.stringify(paiements, null, 2));
    
    const txns = await prisma.studentTransaction.findMany({select: {id:true, type:true, signedAmount:true, description:true, eleveId:true}});
    console.log('StudentTransactions:', JSON.stringify(txns, null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
