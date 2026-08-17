const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Students with PREPAYMENT transactions (wallet-based)
  const withPrepay = await prisma.studentTransaction.groupBy({
    by: ["eleveId"],
    where: { type: "PREPAYMENT" },
    _sum: { signedAmount: true },
    _count: { id: true },
  });

  console.log("=== Students with PREPAYMENT transactions ===");
  for (const row of withPrepay) {
    const s = await prisma.utilisateur.findUnique({
      where: { id: row.eleveId },
      select: {
        id: true,
        prenom: true,
        nom: true,
        centerId: true,
        actif: true,
      },
    });
    const [trans, paiements, cons, bal] = await Promise.all([
      prisma.studentTransaction.findMany({
        where: { eleveId: row.eleveId },
        orderBy: { date: "asc" },
        select: {
          type: true,
          amount: true,
          signedAmount: true,
          date: true,
          status: true,
          description: true,
          reference: true,
          attendanceId: true,
        },
      }),
      prisma.paiement.findMany({
        where: { eleveId: row.eleveId },
        select: { montant: true, groupeId: true, datePaiement: true },
      }),
      prisma.studentTransaction.aggregate({
        _sum: { signedAmount: true },
        where: { eleveId: row.eleveId, type: "COURSE_CONSUMPTION", status: "active" },
      }),
      prisma.studentTransaction.groupBy({
        by: ["eleveId"],
        where: {
          centerId: s.centerId,
          eleveId: row.eleveId,
          type: { not: "COURSE_CONSUMPTION" },
          NOT: { type: "REVERSAL", reversalOf: { type: "COURSE_CONSUMPTION" } },
        },
        _sum: { signedAmount: true },
      }),
    ]);
    const present = await prisma.presence.count({ where: { eleveId: row.eleveId, statut: "present" } });
    const absent = await prisma.presence.count({ where: { eleveId: row.eleveId, statut: "absent" } });

    console.log(`\n=== ${s?.prenom ?? "?"} ${s?.nom ?? "?"} (${row.eleveId}) actif=${s?.actif} ===`);
    console.log("  Wallet balance:", Number(bal[0]?._sum.signedAmount ?? 0), "| consumed:", Number(cons._sum.signedAmount ?? 0));
    console.log(`  Présences: ${present} présents / ${absent} absents`);
    console.log("  Paiements:", paiements.map((p) => `[${p.datePaiement.toISOString().slice(0,10)} g=${p.groupeId?.slice(0,8) ?? "null"} ${p.montant}DT]`).join(" ") || "aucun");
    console.log("  Transactions:");
    for (const t of trans) {
      console.log(`    [${t.date.toISOString().slice(0,10)}] ${t.type} amount=${t.amount} signed=${t.signedAmount} status=${t.status} att=${t.attendanceId ?? "-"} "${t.description?.slice(0,60)}"`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
