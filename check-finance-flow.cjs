const { PrismaClient } = require("@prisma/client");
const path = require("path");

const cacheDir = path.join(__dirname, "node_modules", ".cache", "prisma", "master", "605197351a3c8bdd595af2d2a9bc3025bca48ea2", "windows");
const queryEngine = path.join(cacheDir, "query_engine-windows.dll.node");

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.utilisateur.findMany({
    where: { role: "eleve", deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 30,
    select: {
      id: true,
      prenom: true,
      nom: true,
      centerId: true,
      inscriptions: {
        where: { statut: "actif" },
        select: { groupeId: true, groupe: { select: { nom: true, prixParSeance: true } } },
      },
    },
  });

  for (const s of students) {
    const [paiements, cons, prepay, balances, presences] = await Promise.all([
      prisma.paiement.findMany({
        where: { eleveId: s.id },
        select: { montant: true, groupeId: true, datePaiement: true, methodePaiement: true },
      }),
      prisma.studentTransaction.aggregate({
        _sum: { signedAmount: true },
        where: { eleveId: s.id, type: "COURSE_CONSUMPTION", status: "active" },
      }),
      prisma.studentTransaction.aggregate({
        _sum: { signedAmount: true },
        where: { eleveId: s.id, type: "PREPAYMENT", status: "active" },
      }),
      prisma.studentTransaction.groupBy({
        by: ["eleveId"],
        where: {
          centerId: s.centerId,
          eleveId: s.id,
          type: { not: "COURSE_CONSUMPTION" },
          NOT: { type: "REVERSAL", reversalOf: { type: "COURSE_CONSUMPTION" } },
        },
        _sum: { signedAmount: true },
      }),
      prisma.presence.findMany({
        where: { eleveId: s.id },
        select: { statut: true },
      }),
    ]);

    const totalPaid = paiements.reduce((a, p) => a + Number(p.montant), 0);
    const consumed = Number(cons._sum.signedAmount ?? 0);
    const prepaid = Number(prepay._sum.signedAmount ?? 0);
    const balance = Number(balances[0]?._sum.signedAmount ?? 0);
    const present = presences.filter((p) => p.statut === "present").length;
    const absent = presences.filter((p) => p.statut === "absent").length;

    console.log(`\n=== ${s.prenom} ${s.nom} (${s.id}) ===`);
    console.log(`  Inscriptions:`, s.inscriptions.map((i) => `${i.groupe.nom} (${i.groupe.prixParSeance}/séance)`).join(", ") || "aucune");
    console.log(`  Paiements: ${paiements.length} → total ${totalPaid} DT`, paiements.map((p) => `[g=${p.groupeId?.slice(0,8) ?? "null"} ${p.montant}DT ${p.methodePaiement} ${p.datePaiement.toISOString().slice(0,10)}]`).join(" "));
    console.log(`  Wallet: prepaid=${prepaid} consumed=${consumed} balance=${balance}`);
    console.log(`  Présences: ${present} présents / ${absent} absents`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
